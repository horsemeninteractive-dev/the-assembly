import { Express, Request, Response } from "express";
import { Server } from "socket.io";
import { randomUUID } from "crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import axios from "axios";
import { GameEngine } from "./gameEngine.ts";
import rateLimit from "express-rate-limit";
import { GameState, RoomInfo, UserInternal } from "../src/types.ts";
import { DEFAULT_ITEMS } from "../src/constants.ts";
import {
  getUser,
  getUserById,
  getUserByGoogleId,
  getUserByDiscordId,
  saveUser,
  makeNewUser,
  getFriends,
  sendFriendRequest,
  acceptFriendRequest,
  isFriend,
  removeFriend,
  getAllLeaderboards,
  getGlobalStats,
  getMatchHistory,
  getPendingFriendRequests,
  searchUsers,
} from "./supabaseService.ts";

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) throw new Error("JWT_SECRET env variable is not set");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getAppUrl(req?: Request): string {
  // Legitimate origins: explicit allowlist + Cloud Run deployment URLs.
  // Cloud Run URLs follow the pattern:
  //   https://<service>-<hash>-<region>.a.run.app
  // We match that exactly rather than using endsWith('.run.app'), which would
  // accept any attacker-controlled subdomain like "evil.run.app".
  const CLOUD_RUN_PATTERN = /^https:\/\/[a-z0-9-]+-[a-z0-9]+-[a-z]{2,4}\.a\.run\.app$/;

  const isAllowedOrigin = (o: string): boolean => {
    const explicit = [process.env.APP_URL, "https://theassembly.web.app", "http://localhost:3000"].filter(Boolean);
    return explicit.includes(o) || CLOUD_RUN_PATTERN.test(o);
  };

  const origin = (req?.query?.origin as string) || (req?.body?.origin as string);
  if (origin && isAllowedOrigin(origin)) return origin;

  if (req?.query?.state) {
    try {
      const stateData = JSON.parse(decodeURIComponent(req.query.state as string));
      if (stateData.origin && isAllowedOrigin(stateData.origin)) {
        return stateData.origin;
      }
    } catch (_) {}
  }

  return process.env.APP_URL || "https://theassembly.web.app";
}

function htmlEscape(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Safely extracts a message from unknown catch values, including axios errors. */
function getErrorMessage(err: unknown): string {
  if (err && typeof err === "object") {
    const e = err as Record<string, unknown>;
    if (e.response && typeof e.response === "object") {
      const r = e.response as Record<string, unknown>;
      if (r.data) return String(r.data);
    }
    if (typeof e.message === "string") return e.message;
  }
  return String(err);
}

function oauthSuccessPage(user: UserInternal, token: string): string {
  const targetOrigin = process.env.APP_URL || "https://theassembly.web.app";

  // Never interpolate user data or tokens directly into a <script> block —
  // a crafted username like </script><script>evil()// would break out of the
  // script context. Instead, store everything in HTML-escaped data attributes
  // and read them from JS via getAttribute(), which is injection-safe.
  const safeUser   = htmlEscape(JSON.stringify(user));
  const safeToken  = htmlEscape(token);
  const safeOrigin = htmlEscape(targetOrigin);

  return `<!DOCTYPE html>
<html><body>
<div id="d"
  data-user="${safeUser}"
  data-token="${safeToken}"
  data-origin="${safeOrigin}"
></div>
<script>
  var el     = document.getElementById('d');
  var user   = JSON.parse(el.getAttribute('data-user'));
  var token  = el.getAttribute('data-token');
  var origin = el.getAttribute('data-origin');
  if (window.opener) {
    window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS', user: user, token: token }, origin);
    window.close();
  } else {
    window.location.href = '/?token=' + encodeURIComponent(token) + '&user=' + encodeURIComponent(JSON.stringify(user));
  }
<\/script>
<p>Authentication successful. Redirecting...</p>
</body></html>`;
}

// ---------------------------------------------------------------------------
// Route registration
// ---------------------------------------------------------------------------

export function registerRoutes(
  app: Express,
  io: Server,
  engine: GameEngine,
  userSockets: Map<string, string>,
  stripe: any
): void {
  const rooms = engine.rooms;

  // ── Rate limiters ────────────────────────────────────────────────────────
  // Strict: auth routes — prevent brute-force and account enumeration.
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many attempts. Please try again later." },
  });

  // Moderate: cost-bearing endpoints (TTS calls Gemini, shop debits points).
  const costLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many requests. Please slow down." },
  });

  // General: blanket cap on all other API routes.
  const generalLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many requests. Please slow down." },
  });

  app.use("/api", generalLimiter);
  app.use("/api/register", authLimiter);
  app.use("/api/login",    authLimiter);
  app.use("/api/tts",      costLimiter);
  app.use("/api/shop/buy", costLimiter);

  // ── Version endpoint ────────────────────────────────────────────────────────
  app.get("/version", (_req: Request, res: Response) => {
    res.setHeader("Cache-Control", "no-store");
    res.json({ version: process.env.APP_VERSION || "dev" });
  });

  // ── Auth ──────────────────────────────────────────────────────────────────

  app.post("/api/register", async (req: Request, res: Response) => {
    const { username, password, avatarUrl } = req.body;
    
    if (!username || typeof username !== 'string' || username.length < 3 || username.length > 20) {
      return res.status(400).json({ error: "Username must be between 3 and 20 characters" });
    }
    if (!password || typeof password !== 'string' || password.length < 8) {
      return res.status(400).json({ error: "Password must be at least 8 characters long" });
    }

    if (await getUser(username)) {
      return res.status(400).json({ error: "Username already exists" });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = makeNewUser({ id: randomUUID(), username, avatarUrl, password: hashedPassword });
    await saveUser(newUser);
    const token = jwt.sign({ username }, JWT_SECRET!, { expiresIn: "30d" });
    const { password: _, ...userWithoutPassword } = newUser as any;
    res.json({ user: userWithoutPassword, token });
  });

  app.post("/api/login", async (req: Request, res: Response) => {
    const { username, password } = req.body;
    const user = await getUser(username);
    if (!user || !user.password || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: "Invalid credentials" });
    }
    const token = jwt.sign({ username }, JWT_SECRET!, { expiresIn: "30d" });
    const { password: _, ...userWithoutPassword } = user as any;
    res.json({ user: userWithoutPassword, token });
  });

  app.get("/api/me", async (req: Request, res: Response) => {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ error: "No token" });
    try {
      const decoded = jwt.verify(token, JWT_SECRET!) as unknown as { username: string };
      const user = await getUser(decoded.username);
      if (!user) return res.status(404).json({ error: "User not found" });
      const { password: _, ...userWithoutPassword } = user as any;
      res.json({ user: userWithoutPassword });
    } catch (_) {
      res.status(401).json({ error: "Invalid token" });
    }
  });

  // Mark tutorial as completed — adds 'tutorial-complete' to claimedRewards
  app.post("/api/tutorial-complete", async (req: Request, res: Response) => {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ error: "No token" });
    try {
      const decoded = jwt.verify(token, JWT_SECRET!) as unknown as { username: string };
      const user = await getUser(decoded.username);
      if (!user) return res.status(404).json({ error: "User not found" });
      if (!user.claimedRewards.includes("tutorial-complete")) {
        user.claimedRewards.push("tutorial-complete");
        await saveUser(user);
      }
      const { password: _, ...safe } = user as any;
      res.json({ user: safe });
    } catch (_) {
      res.status(401).json({ error: "Invalid token" });
    }
  });

  // Match history — returns last 20 games for a user
  app.get("/api/match-history/:userId", async (req: Request, res: Response) => {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ error: "No token" });
    try {
      jwt.verify(token, JWT_SECRET!);
      const history = await getMatchHistory(req.params.userId, 20);
      res.json({ history });
    } catch (_) {
      res.status(401).json({ error: "Invalid token" });
    }
  });

  // Claim a season pass reward
  app.post("/api/pass/claim", async (req: Request, res: Response) => {
    const token = req.headers.authorization?.split(" ")[1];
    const { rewardId, itemId } = req.body;
    if (!token) return res.status(401).json({ error: "No token" });
    try {
      const decoded = jwt.verify(token, JWT_SECRET!) as unknown as { username: string };
      const user = await getUser(decoded.username);
      if (!user) return res.status(404).json({ error: "User not found" });
      if (user.claimedRewards.includes(rewardId)) {
        return res.status(400).json({ error: "Already claimed" });
      }
      // Grant the cosmetic item if one is attached
      if (itemId && !user.ownedCosmetics.includes(itemId)) {
        user.ownedCosmetics.push(itemId);
      }
      // Grant CP for the level-30 reward
      if (rewardId === "pass-0-lvl30") {
        user.cabinetPoints = (user.cabinetPoints ?? 0) + 500;
      }
      user.claimedRewards.push(rewardId);
      await saveUser(user);
      const { password: _, ...safe } = user as any;
      res.json({ user: safe });
    } catch (_) {
      res.status(401).json({ error: "Invalid token" });
    }
  });

  // Pin/unpin achievements — body: { pinnedAchievements: string[] } (max 3 IDs)
  app.post("/api/achievements/pin", async (req: Request, res: Response) => {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ error: "No token" });
    try {
      const decoded = jwt.verify(token, JWT_SECRET!) as unknown as { username: string };
      const user = await getUser(decoded.username);
      if (!user) return res.status(404).json({ error: "User not found" });

      const { pinnedAchievements } = req.body;
      if (!Array.isArray(pinnedAchievements) || pinnedAchievements.length > 3) {
        return res.status(400).json({ error: "pinnedAchievements must be an array of up to 3 IDs" });
      }

      // Verify each ID is actually earned by this user
      const earned = new Set((user.earnedAchievements ?? []).map((a: any) =>
        typeof a === "string" ? a : a.id
      ));
      const valid = pinnedAchievements.filter((id: string) => earned.has(id)).slice(0, 3);

      user.pinnedAchievements = valid;
      await saveUser(user);
      const { password: _pw, ...safe } = user as any;
      res.json({ user: safe });
    } catch (_) {
      res.status(401).json({ error: "Invalid token" });
    }
  });

  // Recently played with — returns the stored list from the user record
  app.get("/api/recently-played", async (req: Request, res: Response) => {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ error: "No token" });
    try {
      const decoded = jwt.verify(token, JWT_SECRET!) as unknown as { username: string };
      const user = await getUser(decoded.username);
      if (!user) return res.status(404).json({ error: "User not found" });
      res.json({ recentlyPlayedWith: user.recentlyPlayedWith ?? [] });
    } catch (_) {
      res.status(401).json({ error: "Invalid token" });
    }
  });

  // ── Google OAuth ──────────────────────────────────────────────────────────

  app.get("/api/auth/google/url", (req: Request, res: Response) => {
    const origin = getAppUrl(req);
    const state  = encodeURIComponent(JSON.stringify({ origin }));
    const clientId = process.env.GOOGLE_CLIENT_ID;
    console.log("Google Client ID:", clientId);
    if (!clientId) {
        console.error("GOOGLE_CLIENT_ID is not set!");
        return res.status(500).json({ error: "Google OAuth not configured" });
    }
    const params = new URLSearchParams({
      client_id:     clientId,
      redirect_uri:  `${origin}/auth/google/callback`,
      response_type: "code",
      scope:         "openid profile email",
      access_type:   "offline",
      prompt:        "consent",
      state,
    });
    res.json({ url: `https://accounts.google.com/o/oauth2/v2/auth?${params}` });
  });

  app.get(["/auth/google/callback", "/auth/google/callback/"], async (req: Request, res: Response) => {
    const { code } = req.query;
    if (!code) return res.status(400).send("No code provided");
    try {
      const origin      = getAppUrl(req);
      const redirectUri = `${origin}/auth/google/callback`;
      const tokenRes    = await axios.post("https://oauth2.googleapis.com/token", {
        code, redirect_uri: redirectUri, grant_type: "authorization_code",
        client_id:     process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
      });
      const userRes    = await axios.get("https://www.googleapis.com/oauth2/v3/userinfo", {
        headers: { Authorization: `Bearer ${tokenRes.data.access_token}` },
      });
      const googleUser = userRes.data;
      const fallback   = `google_${googleUser.sub}`;

      let user = await getUserByGoogleId(googleUser.sub);
      if (!user) {
        let username = googleUser.name || fallback;
        if (await getUser(username)) username = fallback;
        user = makeNewUser({ id: randomUUID(), username, avatarUrl: googleUser.picture, googleId: googleUser.sub });
        await saveUser(user);
      } else {
        user.avatarUrl = googleUser.picture;
        await saveUser(user);
      }

      const token = jwt.sign({ username: user.username }, JWT_SECRET!, { expiresIn: "30d" });
      res.send(oauthSuccessPage(user, token));
    } catch (err: unknown) {
      console.error("Google OAuth Error:", getErrorMessage(err));
      res.status(500).send("Authentication failed");
    }
  });

  // ── Discord OAuth ─────────────────────────────────────────────────────────

  async function handleDiscordAuth(code: string, origin: string) {
      const redirectUri = `${origin}/auth/discord/callback`;
      const tokenRes    = await axios.post(
        "https://discord.com/api/oauth2/token",
        new URLSearchParams({
          client_id:     process.env.DISCORD_CLIENT_ID!,
          client_secret: process.env.DISCORD_CLIENT_SECRET!,
          grant_type:    "authorization_code",
          code:          code as string,
          redirect_uri:  redirectUri,
        })
      );
      const userRes     = await axios.get("https://discord.com/api/users/@me", {
        headers: { Authorization: `Bearer ${tokenRes.data.access_token}` },
      });
      const discordUser = userRes.data;
      const fallback    = `discord_${discordUser.id}`;
      const avatarUrl   = discordUser.avatar
        ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png`
        : `https://cdn.discordapp.com/embed/avatars/${parseInt(discordUser.discriminator) % 5}.png`;

      let user = await getUserByDiscordId(discordUser.id);
      if (!user) {
        let username = discordUser.username || fallback;
        if (await getUser(username)) username = fallback;
        user = makeNewUser({ id: randomUUID(), username, avatarUrl, discordId: discordUser.id });
        await saveUser(user);
      } else {
        user.avatarUrl = avatarUrl;
        await saveUser(user);
      }

      const token = jwt.sign({ username: user.username }, JWT_SECRET!, { expiresIn: "30d" });
      return { user, token };
  }

  app.get("/api/auth/discord/url", (req: Request, res: Response) => {
    const origin = getAppUrl(req);
    const state  = encodeURIComponent(JSON.stringify({ origin }));
    const clientId = process.env.DISCORD_CLIENT_ID;
    console.log("Discord Client ID:", clientId);
    if (!clientId) {
        console.error("DISCORD_CLIENT_ID is not set!");
        return res.status(500).json({ error: "Discord OAuth not configured" });
    }
    const params = new URLSearchParams({
      client_id:     clientId,
      redirect_uri:  `${origin}/auth/discord/callback`,
      response_type: "code",
      scope:         "identify email",
      state,
    });
    res.json({ url: `https://discord.com/api/oauth2/authorize?${params}` });
  });

  app.post("/api/auth/discord/callback", async (req: Request, res: Response) => {
    const { code } = req.body;
    if (!code) return res.status(400).json({ error: "No code provided" });
    try {
      const origin = getAppUrl(req);
      const { user, token } = await handleDiscordAuth(code, origin);
      const { password: _, ...userWithoutPassword } = user as any;
      res.json({ user: userWithoutPassword, token });
    } catch (err: unknown) {
      console.error("Discord Activity Auth Error:", getErrorMessage(err));
      res.status(500).json({ error: "Authentication failed" });
    }
  });

  app.get(["/auth/discord/callback", "/auth/discord/callback/"], async (req: Request, res: Response) => {
    const { code } = req.query;
    if (!code) return res.status(400).send("No code provided");
    try {
      const origin = getAppUrl(req);
      const { user, token } = await handleDiscordAuth(code as string, origin);
      res.send(oauthSuccessPage(user, token));
    } catch (err: unknown) {
      console.error("Discord OAuth Error:", getErrorMessage(err));
      res.status(500).send("Authentication failed");
    }
  });

  // ── Rooms ─────────────────────────────────────────────────────────────────

  app.get("/api/rooms", async (_req: Request, res: Response) => {
    const roomList = await Promise.all(
      Array.from(engine.rooms.entries()).map(async ([id, state]) => {
        // Compute average ELO of human players in room
        let averageElo: number | undefined;
        const humanPlayers = state.players.filter(p => !p.isAI && p.userId);
        if (humanPlayers.length > 0) {
          const elos = await Promise.all(
            humanPlayers.map(async p => {
              const u = await getUserById(p.userId!);
              return u?.stats?.elo ?? 1000;
            })
          );
          averageElo = Math.round(elos.reduce((a, b) => a + b, 0) / elos.length);
        }
        return {
          id,
          name:          state.roomId,
          playerCount:   state.players.length,
          maxPlayers:    state.maxPlayers,
          phase:         state.phase,
          actionTimer:   state.actionTimer,
          playerAvatars: state.players.map(p => p.avatarUrl || "").filter(Boolean),
          mode:          state.mode,
          averageElo,
          privacy:       state.privacy ?? 'public',
          isLocked:      state.isLocked ?? false,
        } as RoomInfo;
      })
    );
    res.json(roomList);
  });

  app.get("/api/leaderboard", async (_req: Request, res: Response) => {
    const boards = await getAllLeaderboards();
    const strip = (arr: any[]) => arr.map(({ password: _, ...u }) => u);
    res.json({
      overall: strip(boards.overall),
      ranked:  strip(boards.ranked),
      casual:  strip(boards.casual),
      classic: strip(boards.classic),
    });
  });

  app.get("/api/global-stats", async (_req: Request, res: Response) => {
    try {
      const stats = await getGlobalStats();
      res.json(stats || { civilWins: 0, stateWins: 0 });
    } catch (err) {
      console.error("Error fetching global stats:", err);
      res.json({ civilWins: 0, stateWins: 0 });
    }
  });

  app.get("/api/rejoin-info", (req: Request, res: Response) => {
    const userId = req.query.userId as string;
    if (!userId) return res.json({ canRejoin: false });
    for (const state of engine.rooms.values()) {
      const player = state.players.find(p => p.userId === userId && p.isDisconnected);
      if (player) {
        return res.json({
          canRejoin: true,
          roomId:    state.roomId,
          roomName:  state.roomId,
          mode:      state.mode,
        });
      }
    }
    res.json({ canRejoin: false });
  });

  // ── Shop ──────────────────────────────────────────────────────────────────

  app.post("/api/shop/buy", async (req: Request, res: Response) => {
    const token = req.headers.authorization?.split(" ")[1];
    const { itemId } = req.body;
    if (!token) return res.status(401).json({ error: "No token" });
    try {
      const decoded = jwt.verify(token, JWT_SECRET!) as unknown as { username: string };
      const user    = await getUser(decoded.username);
      if (!user)                                  return res.status(404).json({ error: "User not found" });
      
      const item = DEFAULT_ITEMS.find(i => i.id === itemId);
      if (!item) return res.status(404).json({ error: "Item not found" });
      
      if (user.stats.points < item.price)              return res.status(400).json({ error: "Not enough points" });
      if (user.ownedCosmetics.includes(itemId))   return res.status(400).json({ error: "Already owned" });
      
      user.stats.points -= item.price;
      user.ownedCosmetics.push(itemId);
      await saveUser(user);
      const { password: _, ...userWithoutPassword } = user;
      res.json({ user: userWithoutPassword });
    } catch (_) {
      res.status(401).json({ error: "Invalid token" });
    }
  });

  // ── Stripe Payments ──────────────────────────────────────────────────────
  
  const CP_PACKAGES = [
    { id: "starter", name: "Starter Bundle", cp: 500, price: 499 }, // $4.99
    { id: "pro", name: "Pro Pack", cp: 1200, price: 999 }, // $9.99
    { id: "elite", name: "Elite Vault", cp: 3000, price: 1999 }, // $19.99
    { id: "master", name: "Assembly Master", cp: 10000, price: 4999 }, // $49.99
  ];

  app.post("/api/create-checkout-session", async (req: Request, res: Response) => {
    const token = req.headers.authorization?.split(" ")[1];
    const { packageId } = req.body;
    
    if (!token) return res.status(401).json({ error: "No token" });
    
    try {
      const decoded = jwt.verify(token, JWT_SECRET!) as unknown as { username: string };
      const user = await getUser(decoded.username);
      if (!user) return res.status(404).json({ error: "User not found" });

      const pkg = CP_PACKAGES.find(p => p.id === packageId);
      if (!pkg) return res.status(400).json({ error: "Invalid package" });

      const origin = getAppUrl(req);

      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        line_items: [
          {
            price_data: {
              currency: "usd",
              product_data: {
                name: pkg.name,
                description: `Purchase ${pkg.cp} Cabinet Points`,
              },
              unit_amount: pkg.price,
            },
            quantity: 1,
          },
        ],
        mode: "payment",
        success_url: `${origin}/?purchase=success`,
        cancel_url: `${origin}/?purchase=cancel`,
        metadata: {
          userId: user.id,
          cpAmount: pkg.cp.toString(),
        },
      });

      res.json({ url: session.url });
    } catch (err: any) {
      console.error("[Stripe] Create Session Error:", err.message);
      res.status(500).json({ error: "Failed to create checkout session" });
    }
  });

  // ── Friends ───────────────────────────────────────────────────────────────

  app.get("/api/friends/status", async (req: Request, res: Response) => {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ error: "No token" });
    try {
      const decoded = jwt.verify(token, JWT_SECRET!) as unknown as { username: string };
      const user = await getUser(decoded.username);
      if (!user) return res.status(404).json({ error: "User not found" });
      const friends = await getFriends(user.id);
      const statuses: Record<string, { isOnline: boolean; roomId?: string }> = {};
      for (const friend of friends) {
        const friendSocketId = userSockets.get(friend.id);
        if (friendSocketId) {
          let roomId: string | undefined;
          for (const [rId, state] of rooms.entries()) {
            if (state.players.some(p => p.userId === friend.id && !p.isDisconnected)) {
              roomId = rId;
              break;
            }
          }
          statuses[friend.id] = { isOnline: true, roomId };
        } else {
          statuses[friend.id] = { isOnline: false };
        }
      }
      res.json({ statuses });
    } catch (_) {
      res.status(401).json({ error: "Invalid token" });
    }
  });

  // Pending friend requests received by this user
  app.get("/api/friends/pending", async (req: Request, res: Response) => {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ error: "No token" });
    try {
      const decoded = jwt.verify(token, JWT_SECRET!) as unknown as { username: string };
      const user = await getUser(decoded.username);
      if (!user) return res.status(404).json({ error: "User not found" });
      const pending = await getPendingFriendRequests(user.id);
      res.json({ pending });
    } catch (_) {
      res.status(401).json({ error: "Invalid token" });
    }
  });


  // Search users by username (for friend search)
  app.get("/api/users/search", async (req: Request, res: Response) => {
    const token = req.headers.authorization?.split(" ")[1];
    const query = req.query.q as string;
    if (!token) return res.status(401).json({ error: "No token" });
    if (!query || query.length < 2) return res.json({ users: [] });
    try {
      const decoded = jwt.verify(token, JWT_SECRET!) as unknown as { username: string };
      const currentUser = await getUser(decoded.username);
      if (!currentUser) return res.status(404).json({ error: "User not found" });
      const results = await searchUsers(query, currentUser.id);
      // Attach isFriend status to each result
      const withStatus = await Promise.all(results.map(async (u: UserInternal) => {
        const friendStatus = await isFriend(currentUser.id, u.id);
        const { password: _, ...safe } = u as any;
        return { ...safe, isFriend: friendStatus };
      }));
      res.json({ users: withStatus });
    } catch (_) {
      res.status(401).json({ error: "Invalid token" });
    }
  });

  app.get("/api/friends", async (req: Request, res: Response) => {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ error: "No token" });
    try {
      const decoded = jwt.verify(token, JWT_SECRET!) as unknown as { username: string };
      const user = await getUser(decoded.username);
      if (!user) return res.status(404).json({ error: "User not found" });
      const friends = await getFriends(user.id);
      res.json({ friends });
    } catch (_) {
      res.status(401).json({ error: "Invalid token" });
    }
  });

  app.post("/api/friends/request", async (req: Request, res: Response) => {
    const token = req.headers.authorization?.split(" ")[1];
    const { targetUserId } = req.body;
    if (!token) return res.status(401).json({ error: "No token" });
    try {
      const decoded = jwt.verify(token, JWT_SECRET!) as unknown as { username: string };
      const user = await getUser(decoded.username);
      if (!user) return res.status(404).json({ error: "User not found" });
      await sendFriendRequest(user.id, targetUserId);
      res.json({ success: true });
    } catch (_) {
      res.status(401).json({ error: "Invalid token" });
    }
  });

  app.post("/api/friends/accept", async (req: Request, res: Response) => {
    const token = req.headers.authorization?.split(" ")[1];
    const { targetUserId } = req.body;
    if (!token) return res.status(401).json({ error: "No token" });
    try {
      const decoded = jwt.verify(token, JWT_SECRET!) as unknown as { username: string };
      const user = await getUser(decoded.username);
      if (!user) return res.status(404).json({ error: "User not found" });
      await acceptFriendRequest(user.id, targetUserId);
      res.json({ success: true });
    } catch (_) {
      res.status(401).json({ error: "Invalid token" });
    }
  });

  app.get("/api/user/:userId", async (req: Request, res: Response) => {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ error: "No token" });
    try {
      const decoded = jwt.verify(token, JWT_SECRET!) as unknown as { username: string };
      const currentUser = await getUser(decoded.username);
      if (!currentUser) return res.status(404).json({ error: "User not found" });
      
      const user = await getUserById(req.params.userId);
      if (!user) return res.status(404).json({ error: "User not found" });
      
      const isFriendStatus = await isFriend(currentUser.id, user.id);
      
      const { password: _, ...userWithoutPassword } = user as any;
      res.json({ user: userWithoutPassword, isFriend: isFriendStatus });
    } catch (_) {
      res.status(401).json({ error: "Invalid token" });
    }
  });

  app.delete("/api/friends/:targetUserId", async (req: Request, res: Response) => {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ error: "No token" });
    try {
      const decoded = jwt.verify(token, JWT_SECRET!) as unknown as { username: string };
      const user = await getUser(decoded.username);
      if (!user) return res.status(404).json({ error: "User not found" });
      await removeFriend(user.id, req.params.targetUserId);
      res.json({ success: true });
    } catch (_) {
      res.status(401).json({ error: "Invalid token" });
    }
  });

  app.post("/api/friends/invite/:friendId", async (req: Request, res: Response) => {
    const token = req.headers.authorization?.split(" ")[1];
    const { roomId } = req.body;
    if (!token) return res.status(401).json({ error: "No token" });
    try {
      const decoded = jwt.verify(token, JWT_SECRET!) as unknown as { username: string };
      const user = await getUser(decoded.username);
      if (!user) return res.status(404).json({ error: "User not found" });
      
      const friendSocketId = userSockets.get(req.params.friendId);
      if (friendSocketId) {
        io.to(friendSocketId).emit("friendInvite", { fromUserId: user.id, fromUsername: user.username, roomId });
      }
      res.json({ success: true });
    } catch (_) {
      res.status(401).json({ error: "Invalid token" });
    }
  });

  app.post("/api/profile/frame", async (req: Request, res: Response) => {
    const token = req.headers.authorization?.split(" ")[1];
    const { frameId, policyStyle, votingStyle, music, soundPack, backgroundId } = req.body;
    if (!token) return res.status(401).json({ error: "No token" });
    try {
      const decoded = jwt.verify(token, JWT_SECRET!) as unknown as { username: string };
      const user    = await getUser(decoded.username);
      if (!user) return res.status(404).json({ error: "User not found" });

      const PASS_ITEM_LEVELS: { [key: string]: number } = {
        'bg-pass-0': 10,
        'vote-pass-0': 20,
        'music-pass-0': 40,
        'frame-pass-0': 50,
      };

      const isItemUnlocked = (itemId: string) => {
        if (user.ownedCosmetics.includes(itemId)) return true;
        const requiredLevel = PASS_ITEM_LEVELS[itemId];
        if (requiredLevel) {
          const userLevel = Math.floor(user.stats.gamesPlayed / 5) + 1;
          return userLevel >= requiredLevel;
        }
        return false;
      };

      if (frameId !== undefined) {
        if (frameId && !isItemUnlocked(frameId)) return res.status(400).json({ error: "Not owned" });
        user.activeFrame = frameId;
      }
      if (policyStyle !== undefined) {
        if (policyStyle && !isItemUnlocked(policyStyle)) return res.status(400).json({ error: "Not owned" });
        user.activePolicyStyle = policyStyle;
      }
      if (votingStyle !== undefined) {
        if (votingStyle && !isItemUnlocked(votingStyle)) return res.status(400).json({ error: "Not owned" });
        user.activeVotingStyle = votingStyle;
      }
      if (music !== undefined) {
        if (music && !isItemUnlocked(music)) return res.status(400).json({ error: "Not owned" });
        user.activeMusic = music;
      }
      if (soundPack !== undefined) {
        if (soundPack && !isItemUnlocked(soundPack)) return res.status(400).json({ error: "Not owned" });
        user.activeSoundPack = soundPack;
      }
      if (backgroundId !== undefined) {
        if (backgroundId && !isItemUnlocked(backgroundId)) return res.status(400).json({ error: "Not owned" });
        user.activeBackground = backgroundId;
      }

      await saveUser(user);

      // Push cosmetic changes to all live rooms immediately
      for (const room of rooms.values()) {
        let changed = false;
        for (const p of room.players) {
          if (p.userId === user.id) {
            if (frameId      !== undefined) p.activeFrame      = frameId;
            if (policyStyle  !== undefined) p.activePolicyStyle = policyStyle;
            if (votingStyle  !== undefined) p.activeVotingStyle = votingStyle;
            changed = true;
          }
        }
        if (changed) engine.broadcastState(room.roomId);
      }

      const { password: _, ...userWithoutPassword } = user;
      res.json({ user: userWithoutPassword });
    } catch (_) {
      res.status(401).json({ error: "Invalid token" });
    }
  });

  // ── TTS proxy ─────────────────────────────────────────────────────────────
  // Calls Gemini TTS server-side so the API key is never exposed in the
  // client bundle. Returns the base64-encoded WAV audio from Gemini directly.

  app.post("/api/tts", async (req: Request, res: Response) => {
    const { text, voice } = req.body as { text?: string; voice?: string };

    if (!text || typeof text !== "string" || text.trim().length === 0) {
      return res.status(400).json({ error: "text is required" });
    }
    if (text.length > 500) {
      return res.status(400).json({ error: "text too long (max 500 chars)" });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(503).json({ error: "TTS not configured" });
    }

    try {
      const geminiRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text }] }],
            generationConfig: {
              responseModalities: ["AUDIO"],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: { voiceName: voice ?? "Puck" },
                },
              },
            },
          }),
        }
      );

      if (!geminiRes.ok) {
        const err = await geminiRes.text();
        console.error("[TTS] Gemini error:", err);
        return res.status(502).json({ error: "TTS upstream error" });
      }

      const data = await geminiRes.json() as any;
      const base64Audio = data?.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

      if (!base64Audio) {
        return res.status(502).json({ error: "No audio returned from TTS" });
      }

      res.json({ audio: base64Audio });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[TTS] Request failed:", msg);
      res.status(500).json({ error: "TTS request failed" });
    }
  });
}
