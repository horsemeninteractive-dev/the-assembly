/**
 * test-30-games.mjs
 * Runs 30 sequential 8-player casual games via Socket.IO.
 * The human player auto-acts on every phase so games complete without manual input.
 */

import { io } from "socket.io-client";
import { randomUUID } from "crypto";

const SERVER = "http://localhost:3000";
const TOTAL_GAMES = 30;
const GAME_TIMEOUT_MS = 300_000; // 5 min max per game (games typically take 1-3 min)

const results = [];

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runGame(gameNum) {
  return new Promise((resolve, reject) => {
    const roomId = `test-${randomUUID().slice(0, 8)}`;
    const playerName = `Tester`;
    let settled = false;
    let myId = null;
    let lastActedPhase = null;
    let lastActedRound = null;
    let declaredPres = false;
    let declaredChan = false;

    const socket = io(SERVER, {
      transports: ["websocket"],
      reconnection: false,
    });

    const timeout = setTimeout(() => {
      if (!settled) {
        settled = true;
        socket.disconnect();
        reject(new Error(`Game ${gameNum} timed out after ${GAME_TIMEOUT_MS / 1000}s`));
      }
    }, GAME_TIMEOUT_MS);

    socket.on("connect", () => {
      myId = socket.id;
      // Join a casual 8-player room with a 5s action timer to speed things up
      socket.emit("joinRoom", {
        roomId,
        name: playerName,
        maxPlayers: 8,
        actionTimer: 5,
        mode: "Casual",
      });

      // Small delay then toggle ready — this triggers fillWithAI + startGame
      setTimeout(() => {
        socket.emit("toggleReady");
      }, 500);
    });

    socket.on("gameStateUpdate", (state) => {
      if (settled) return;
      if (!state.players) return;

      const me = state.players.find(p => p.id === myId);
      if (!me) return;

      // Reset declaration tracking on new rounds
      const phaseRoundKey = `${state.phase}-${state.round}`;
      if (state.round !== lastActedRound) {
        declaredPres = false;
        declaredChan = false;
        lastActedRound = state.round;
      }

      // ── Title ability prompt — always decline ──
      if (state.titlePrompt && state.titlePrompt.playerId === myId) {
        socket.emit("useTitleAbility", { use: false });
        return;
      }

      // ── Veto response — always deny ──
      if (state.vetoRequested && me.isPresident && !me.hasActed) {
        socket.emit("vetoResponse", false);
        return;
      }

      switch (state.phase) {
        case "Nominate_Chancellor": {
          if (me.isPresidentialCandidate && !me.hasActed) {
            const eligible = state.players.filter(
              p => p.isAlive && p.id !== myId && !p.wasChancellor &&
                   p.id !== state.rejectedChancellorId &&
                   p.id !== state.detainedPlayerId &&
                   !(state.players.filter(pl => pl.isAlive).length > 5 && p.wasPresident)
            );
            if (eligible.length > 0) {
              const target = eligible[Math.floor(Math.random() * eligible.length)];
              socket.emit("nominateChancellor", target.id);
            } else {
              // Fallback: pick any alive non-self player
              const fallback = state.players.filter(p => p.isAlive && p.id !== myId);
              if (fallback.length > 0) {
                socket.emit("nominateChancellor", fallback[0].id);
              }
            }
          }
          break;
        }
        case "Voting": {
          if (me.isAlive && !me.hasActed && me.id !== state.detainedPlayerId && !me.vote) {
            socket.emit("vote", "Aye");
          }
          break;
        }
        case "Legislative_President": {
          if (me.isPresident && !me.hasActed) {
            if (state.drawnPolicies && state.drawnPolicies.length > 0) {
              socket.emit("presidentDiscard", 0);
            }
          }
          break;
        }
        case "Legislative_Chancellor": {
          // Play a policy if we're chancellor and haven't acted
          if (me.isChancellor && !me.hasActed) {
            if (state.chancellorPolicies && state.chancellorPolicies.length > 0) {
              socket.emit("chancellorPlay", 0);
            }
          }
          // Handle declarations (can happen after hasActed is set)
          if (state.lastEnactedPolicy?.trackerReady) {
            if (me.isPresident && !declaredPres) {
              const presAlreadyDeclared = state.declarations?.some(d => d.type === "President");
              if (!presAlreadyDeclared) {
                declaredPres = true;
                socket.emit("declarePolicies", { civ: 1, sta: 1, drewCiv: 1, drewSta: 2, type: "President" });
              }
            }
            if (me.isChancellor && !declaredChan) {
              const chanAlreadyDeclared = state.declarations?.some(d => d.type === "Chancellor");
              if (!chanAlreadyDeclared) {
                declaredChan = true;
                socket.emit("declarePolicies", { civ: 1, sta: 1, type: "Chancellor" });
              }
            }
          }
          break;
        }
        case "Executive_Action": {
          if (me.isPresident && !me.hasActed) {
            const targets = state.players.filter(p => p.isAlive && p.id !== myId);
            if (targets.length > 0) {
              const target = targets[Math.floor(Math.random() * targets.length)];
              socket.emit("performExecutiveAction", target.id);
            }
          }
          break;
        }
        case "GameOver": {
          if (!settled) {
            settled = true;
            clearTimeout(timeout);
            const result = {
              game: gameNum,
              roomId,
              winner: state.winner || "N/A",
              reason: state.winReason || "Unknown",
              rounds: state.round,
              civil: state.civilDirectives,
              state: state.stateDirectives,
            };
            results.push(result);
            // Leave the room cleanly
            socket.emit("leaveRoom");
            setTimeout(() => socket.disconnect(), 200);
            resolve(result);
          }
          break;
        }
      }
    });

    socket.on("connect_error", (err) => {
      if (!settled) {
        settled = true;
        clearTimeout(timeout);
        reject(new Error(`Game ${gameNum} connection error: ${err.message}`));
      }
    });

    socket.on("error", (msg) => {
      // Game-level errors — ignore silently
    });
  });
}

async function main() {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`  THE ASSEMBLY - 30-Game Test Run`);
  console.log(`  Mode: Casual | Players: 8 (1 human + 7 bots)`);
  console.log(`  Action Timer: 5s`);
  console.log(`${"=".repeat(60)}\n`);

  let passed = 0;
  let failed = 0;

  for (let i = 1; i <= TOTAL_GAMES; i++) {
    const start = Date.now();
    try {
      const result = await runGame(i);
      const elapsed = ((Date.now() - start) / 1000).toFixed(1);
      const winner = String(result.winner).padEnd(5);
      const reason = String(result.reason).padEnd(45);
      console.log(
        `  [OK] Game ${String(i).padStart(2)} | ` +
        `Winner: ${winner} | ` +
        `Reason: ${reason} | ` +
        `R:${String(result.rounds).padStart(2)} | ` +
        `C:${result.civil} S:${result.state} | ` +
        `${elapsed}s`
      );
      passed++;
    } catch (err) {
      console.log(`  [FAIL] Game ${String(i).padStart(2)} | ${err.message}`);
      failed++;
    }
    // Small pause between games 
    await sleep(300);
  }

  console.log(`\n${"=".repeat(60)}`);
  console.log(`  RESULTS: ${passed} passed, ${failed} failed out of ${TOTAL_GAMES}`);
  
  if (results.length > 0) {
    const civilWins = results.filter(r => r.winner === "Civil").length;
    const stateWins = results.filter(r => r.winner === "State").length;
    const avgRounds = (results.reduce((sum, r) => sum + r.rounds, 0) / results.length).toFixed(1);
    console.log(`  Civil wins: ${civilWins} | State wins: ${stateWins} | Avg rounds: ${avgRounds}`);
  }
  
  console.log(`${"=".repeat(60)}\n`);
  
  process.exit(failed > 0 ? 1 : 0);
}

main();
