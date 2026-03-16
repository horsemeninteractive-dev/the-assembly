/**
 * test-debug.mjs — Single game diagnostic to find where games get stuck
 */

import { io } from "socket.io-client";
import { randomUUID } from "crypto";

const SERVER = "http://localhost:3000";

const socket = io(SERVER, {
  transports: ["websocket"],
  reconnection: false,
});

let myId = null;
const roomId = `debug-${randomUUID().slice(0, 8)}`;

socket.on("connect", () => {
  myId = socket.id;
  console.log(`Connected as ${myId}, joining room ${roomId}`);
  
  socket.emit("joinRoom", {
    roomId,
    name: "DebugTester",
    maxPlayers: 8,
    actionTimer: 5,
    mode: "Casual",
  });

  setTimeout(() => {
    console.log("Toggling ready...");
    socket.emit("toggleReady");
  }, 500);
});

let stateCount = 0;

socket.on("gameStateUpdate", (state) => {
  stateCount++;
  const me = state.players?.find(p => p.id === myId);
  const phase = state.phase;
  
  // Log every state update with key info
  const meFlags = me ? `alive=${me.isAlive} pres=${me.isPresident} chan=${me.isChancellor} presCand=${me.isPresidentialCandidate} chanCand=${me.isChancellorCandidate} acted=${me.hasActed}` : "NOT FOUND";
  console.log(`[#${stateCount}] Phase: ${phase} | Round: ${state.round} | Me: ${meFlags} | titlePrompt: ${state.titlePrompt?.role || 'none'} (for: ${state.titlePrompt?.playerId === myId ? 'ME' : state.titlePrompt?.playerId || 'n/a'}) | veto: ${state.vetoRequested}`);

  if (!me) return;

  // Title ability — decline
  if (state.titlePrompt && state.titlePrompt.playerId === myId) {
    console.log(`  >> Declining title ability: ${state.titlePrompt.role}`);
    socket.emit("useTitleAbility", { use: false });
    return;
  }

  // Veto response
  if (state.vetoRequested && me.isPresident && !me.hasActed) {
    console.log(`  >> Denying veto`);
    socket.emit("vetoResponse", false);
    return;
  }

  switch (phase) {
    case "Nominate_Chancellor": {
      if (me.isPresidentialCandidate && !me.hasActed) {
        const eligible = state.players.filter(
          p => p.isAlive && p.id !== myId && !p.wasChancellor &&
               p.id !== state.rejectedChancellorId &&
               p.id !== state.detainedPlayerId &&
               !(state.players.filter(pl => pl.isAlive).length > 5 && p.wasPresident)
        );
        if (eligible.length > 0) {
          console.log(`  >> Nominating ${eligible[0].name} (${eligible[0].id})`);
          socket.emit("nominateChancellor", eligible[0].id);
        } else {
          const fallback = state.players.filter(p => p.isAlive && p.id !== myId);
          console.log(`  >> No eligible, fallback nominating ${fallback[0]?.name}`);
          if (fallback[0]) socket.emit("nominateChancellor", fallback[0].id);
        }
      }
      break;
    }
    case "Voting": {
      if (me.isAlive && !me.hasActed && me.id !== state.detainedPlayerId && !me.vote) {
        console.log(`  >> Voting Aye`);
        socket.emit("vote", "Aye");
      }
      break;
    }
    case "Legislative_President": {
      if (me.isPresident && !me.hasActed && state.drawnPolicies?.length > 0) {
        console.log(`  >> President discarding idx 0 (hand: ${state.drawnPolicies})`);
        socket.emit("presidentDiscard", 0);
      }
      break;
    }
    case "Legislative_Chancellor": {
      if (me.isChancellor && !me.hasActed && state.chancellorPolicies?.length > 0) {
        console.log(`  >> Chancellor playing idx 0 (hand: ${state.chancellorPolicies})`);
        socket.emit("chancellorPlay", 0);
      }
      // Declarations
      if (state.lastEnactedPolicy?.trackerReady) {
        if (me.isPresident && !state.declarations?.some(d => d.type === "President" && d.playerId === myId)) {
          console.log(`  >> Declaring as President`);
          socket.emit("declarePolicies", { civ: 1, sta: 1, drewCiv: 1, drewSta: 2, type: "President" });
        }
        if (me.isChancellor && !state.declarations?.some(d => d.type === "Chancellor" && d.playerId === myId)) {
          console.log(`  >> Declaring as Chancellor`);
          socket.emit("declarePolicies", { civ: 1, sta: 1, type: "Chancellor" });
        }
      }
      break;
    }
    case "Executive_Action": {
      if (me.isPresident && !me.hasActed) {
        const targets = state.players.filter(p => p.isAlive && p.id !== myId);
        if (targets.length > 0) {
          console.log(`  >> Exec action on ${targets[0].name}`);
          socket.emit("performExecutiveAction", targets[0].id);
        }
      }
      break;
    }
    case "GameOver": {
      console.log(`\nGAME OVER! Winner: ${state.winner}, Reason: ${state.winReason}, Rounds: ${state.round}`);
      console.log(`Civil: ${state.civilDirectives}, State: ${state.stateDirectives}`);
      setTimeout(() => process.exit(0), 500);
      break;
    }
  }
});

socket.on("privateInfo", (info) => {
  console.log(`[Private] My role: ${info.role}, title: ${info.titleRole || 'none'}`);
});

socket.on("connect_error", (err) => {
  console.error("Connection error:", err.message);
  process.exit(1);
});

// Timeout after 2 minutes
setTimeout(() => {
  console.log("TIMEOUT - game did not complete in 2 minutes");
  process.exit(1);
}, 120_000);
