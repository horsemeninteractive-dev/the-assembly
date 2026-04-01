import { Socket } from 'socket.io';
import { logger } from '../logger';

const GAME_ACTIONS = [
  'userConnected',
  'joinRoom',
  'toggleReady',
  'startLobbyTimer',
  'startGame',
  'sendFriendRequest',
  'acceptFriendRequest',
  'nominateChancellor',
  'vote',
  'presidentDiscard',
  'chancellorPlay',
  'declarePolicies',
  'performExecutiveAction',
  'useTitleAbility',
  'vetoRequest',
  'vetoResponse',
  'playAgain',
  'joinQueue',
  'leaveQueue',
  'kickPlayer',
  'toggleLock',
  'hostStartGame',
  'leaveRoom',
  'updateMediaState',
  'adminDeleteRoom',
  'adminBroadcast',
  'adminUpdateUser',
  'adminUpdateConfig',
  'adminClearRedis',
];

export function registerSocketAuthMiddleware(socket: Socket) {
  socket.use(([event, ...args]: any[], next: (err?: Error) => void) => {
    if (event === 'disconnect') return next();

    const now = Date.now();
    const isChat = event === 'sendMessage';
    const isSignal = event === 'signal';
    const isGameAction = GAME_ACTIONS.includes(event);

    if (!isChat && !isGameAction && !isSignal) return next();

    let CAPACITY = 10;
    let REFILL_RATE = 5;
    let lastKey = 'lastGameLimitCheck';
    let tokenKey = 'gameTokens';

    if (isChat) {
      CAPACITY = 5;
      REFILL_RATE = 1;
      lastKey = 'lastChatLimitCheck';
      tokenKey = 'chatTokens';
    } else if (isSignal) {
      CAPACITY = 200;
      REFILL_RATE = 50; 
      lastKey = 'lastSignalLimitCheck';
      tokenKey = 'signalTokens';
    }

    const last = socket.data[lastKey] || now;
    const tokens = socket.data[tokenKey] ?? CAPACITY;

    const elapsed = now - last;
    const regained = (elapsed / 1000) * REFILL_RATE;
    const currentTokens = Math.min(CAPACITY, tokens + regained);

    if (currentTokens < 1) {
      logger.warn(
        { event, userId: socket.data.userId || 'unauth', socketId: socket.id },
        `Throttling ${isChat ? 'chat' : (isSignal ? 'signal' : 'game action')} event due to rate limit`
      );
      return next(new Error('Rate limit exceeded. Please slow down.'));
    }

    socket.data[tokenKey] = currentTokens - 1;
    socket.data[lastKey] = now;
    next();
  });
}

