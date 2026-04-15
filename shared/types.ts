export type ErrorCode =
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'RATE_LIMITED'
  | 'ROOM_FULL'
  | 'GAME_IN_PROGRESS'
  | 'INVALID_REQUEST'
  | 'NOT_FOUND'
  | 'BANNED'
  | 'ALREADY_EXISTS'
  | 'MAINTENANCE_MODE'
  | 'INTERNAL_ERROR'
  | 'ROOM_LOCKED'
  | 'SERVER_CAPACITY'
  | 'RESOURCE_REMAINING'
  | 'DETAINED'
  | 'INVALID_ACTION';

export interface StructuredError {
  code: ErrorCode;
  message: string;
}

export type Role = 'Civil' | 'State' | 'Overseer';
export type TitleRole =
  | 'Assassin'
  | 'Strategist'
  | 'Broker'
  | 'Handler'
  | 'Auditor'
  | 'Interdictor'
  | 'Archivist'
  | 'Defector'
  | 'Quorum'
  | 'Cipher';

/** Typed payloads for each title ability action. */
export type TitleAbilityData =
  | { use: false }
  | { use: true; role: 'Assassin'; targetId: string }
  | { use: true; role: 'Strategist' }
  | { use: true; role: 'Broker' }
  | { use: true; role: 'Handler' }
  | { use: true; role: 'Auditor' }
  | { use: true; role: 'Interdictor'; targetId: string }
  | { use: true; role: 'Archivist' }
  | { use: true; role: 'Defector'; vote: 'Aye' | 'Nay' }
  | { use: true; role: 'Quorum' }
  | { use: true; role: 'Cipher'; targetId?: string; message: string };

export type PersonalAgendaId =
  | 'chaos_agent'
  | 'the_purist'
  | 'the_dissenter'
  | 'the_dove'
  | 'the_hawk'
  | 'stonewalled'
  | 'short_session'
  | 'the_long_game'
  | 'the_loyalist'
  | 'nominated'
  | 'deadlock'
  | 'prolific'
  | 'the_veteran'
  | 'unity'
  | 'the_mandate'
  | 'clean_sweep'
  | 'the_weathervane'
  | 'productive_session'
  | 'close_race'
  | 'the_swing_vote';

export type AgendaStatus = 'unresolved' | 'completed' | 'failed';

export interface PersonalAgenda {
  id: PersonalAgendaId;
  name: string;
  description: string;
  status: AgendaStatus;
}

export interface PrivateInfo {
  role: Role;
  stateAgents?: { id: string; name: string; role: Role }[];
  titleRole?: TitleRole;
  personalAgenda?: PersonalAgenda;
}
export type Policy = 'Civil' | 'State';

export type TitlePromptContext =
  | { role: 'Auditor'; discardPile: Policy[] }
  | { role: 'Assassin' }
  | { role: 'Strategist' }
  | { role: 'Broker' }
  | { role: 'Handler' }
  | { role: 'Interdictor' }
  | { role: 'Archivist' }
  | { role: 'Defector' }
  | { role: 'Quorum' }
  | { role: 'Cipher' };
export type GamePhase =
  | 'Lobby'
  | 'Nominate_Chancellor'
  | 'Nomination_Review'
  | 'Voting'
  | 'Voting_Reveal'
  | 'Legislative_President'
  | 'Legislative_Chancellor'
  | 'Auditor_Action'
  | 'Assassin_Action'
  | 'Handler_Action'
  | 'Defector_Action'
  | 'Quorum_Action'
  | 'Executive_Action'
  | 'Censure_Action'
  | 'Snap_Election'
  | 'Event_Reveal'
  | 'GameOver';
export type ExecutiveAction =
  | 'Investigate'
  | 'SpecialElection'
  | 'Execution'
  | 'PolicyPeek'
  | 'None';
export type GameMode = 'Casual' | 'Ranked' | 'Classic' | 'Crisis';

export type EventCardId =
  | 'state_of_emergency'
  | 'blackout'
  | 'snap_election'
  | 'iron_mandate'
  | 'open_session'
  | 'censure_motion'
  | 'veiled_proceedings'
  | 'dead_mans_gambit'
  | 'double_or_nothing';

export type EventCardType = 'Immediate' | 'RoundDuration';

export interface EventCard {
  id: EventCardId;
  name: string;
  description: string;
  type: EventCardType;
  icon: string;
}

export interface Achievement {
  id: string;
  earnedAt: string; // ISO timestamp
}

export interface RecentlyPlayedEntry {
  userId: string;
  username: string;
  avatarUrl?: string;
  activeFrame?: string;
  elo: number;
  lastPlayedAt: string; // ISO timestamp
}

export interface UserStats {
  gamesPlayed: number;
  wins: number;
  losses: number;
  civilGames: number;
  stateGames: number;
  overseerGames: number;
  kills: number;
  deaths: number;
  elo: number;
  points: number;
  xp: number;
  agendasCompleted: number;
  civilWins: number;
  stateWins: number;
  overseerWins: number;
  // Per-mode counters for segmented leaderboards
  rankedWins: number;
  rankedGames: number;
  casualWins: number;
  casualGames: number;
  classicWins: number;
  classicGames: number;
  crisisWins: number;
  crisisGames: number;
}

export interface MatchSummary {
  id: string;
  userId: string;
  playedAt: string; // ISO timestamp
  roomName: string;
  mode: GameMode;
  playerCount: number;
  role: Role;
  won: boolean;
  winReason: string;
  rounds: number;
  civilDirectives: number;
  stateDirectives: number;
  agendaId?: PersonalAgendaId;
  agendaName?: string;
  agendaCompleted: boolean;
  xpEarned: number;
  ipEarned: number;
  cpEarned: number;
  matchId?: string;
}

// Sent via socket immediately after a game ends — ephemeral, not persisted
export interface PostMatchResult {
  won: boolean;
  mode: GameMode;
  role: Role;
  eloChange: number; // +20 / -20 / 0 (0 for casual)
  eloBefore: number;
  eloAfter: number;
  roomAverageElo: number;
  xpEarned: number;
  ipEarned: number;
  cpEarned: number;
  clanXpEarned?: number;
  agendaName?: string;
  agendaCompleted: boolean;
  rounds: number;
  civilDirectives: number;
  stateDirectives: number;
  newAchievements: string[]; // IDs of achievements earned this game
}

export interface CosmeticItem {
  id: string;
  name: string;
  price: number;
  type: 'frame' | 'badge' | 'policy' | 'vote' | 'music' | 'sound' | 'background';
  imageUrl?: string;
  description?: string;
}

// ---------------------------------------------------------------------------
// Clan types
// ---------------------------------------------------------------------------

export type ClanRole = 'owner' | 'officer' | 'member';

export interface ClanEmblem {
  iconId: string;
  iconColor: string;
  bgColor: string;
}

export interface ClanSummary {
  id: string;
  tag: string;
  name: string;
  description: string;
  xp: number;
  level: number;
  emblem: ClanEmblem;
  memberCount: number;
}

export interface Clan extends ClanSummary {
  ownerId: string;
  createdAt: string;
  challenges?: ClanChallengeData;
}

export interface ClanMember {
  clanId: string;
  userId: string;
  username: string;
  avatarUrl?: string;
  activeFrame?: string;
  role: ClanRole;
  xpContributed: number;
  joinedAt: string;
  isOnline: boolean;
  currentRoomId?: string;
}

export interface ClanInvite {
  id: string;
  clanId: string;
  clanName: string;
  clanTag: string;
  inviterId: string;
  inviterName: string;
  inviteeId: string;
  status: 'pending' | 'accepted' | 'declined';
  createdAt: string;
}

// Lightweight badge attached to User for in-game PlayerCard display
export interface ClanBadge {
  id: string;
  tag: string;
  name: string;
  emblem: ClanEmblem;
}

// ---------------------------------------------------------------------------

export interface User {
  id: string;
  username: string;
  email?: string;
  avatarUrl?: string;
  createdAt?: string;
  stats: UserStats;
  ownedCosmetics: string[];
  activeFrame?: string;
  activePolicyStyle?: string;
  activeVotingStyle?: string;
  activeMusic?: string;
  activeSoundPack?: string;
  activeBackground?: string;
  cabinetPoints: number;
  claimedRewards: string[];
  earnedAchievements: Achievement[];
  pinnedAchievements: string[]; // up to 3 achievement IDs
  recentlyPlayedWith: RecentlyPlayedEntry[]; // up to 20 entries, most recent first
  clan?: ClanBadge; // null when not in a clan
  isAdmin?: boolean;
  isBanned?: boolean;
  tokenVersion?: number;
  referralCode?: string;
  referredBy?: string;
}

export interface UserInternal extends User {
  password?: string;
  email?: string;
  googleId?: string;
  discordId?: string;
  challengeData?: UserChallengeData;
  referralProcessed?: boolean;
}

export type RoomPrivacy = 'public' | 'friends' | 'private';

export interface RoomInfo {
  id: string;
  name: string;
  playerCount: number;
  maxPlayers: number;
  phase: GamePhase;
  actionTimer: number;
  playerAvatars: string[];
  mode: GameMode;
  averageElo?: number;
  privacy: RoomPrivacy;
  isLocked?: boolean;
  hostName?: string;
  spectatorCount?: number;
  isPractice?: boolean;
}

export interface SystemConfig {
  maintenanceMode: boolean;
  xpMultiplier: number;
  ipMultiplier: number;
  minVersion?: string;
}

export type AIPersonality = 'Honest' | 'Deceptive' | 'Chaotic' | 'Strategic' | 'Aggressive';

export type ChallengeId = string;

export interface ActiveChallenge {
  id: ChallengeId;
  progress: number;
  completed: boolean;
  completedAt?: string;
}

export interface UserChallengeData {
  daily: ActiveChallenge[];
  weekly: ActiveChallenge[];
  seasonal: ActiveChallenge[];
  dailyResetsAt: string;
  weeklyResetsAt: string;
  seasonEndsAt: string;
  dailyPeriod: string;
  weeklyPeriod: string;
  seasonPeriod: string;
}

export interface ClanChallengeData {
  daily: ActiveChallenge[];
  weekly: ActiveChallenge[];
  seasonal: ActiveChallenge[];
  dailyResetsAt: string;
  weeklyResetsAt: string;
  seasonEndsAt: string;
  dailyPeriod: string;
  weeklyPeriod: string;
  seasonPeriod: string;
}

export interface EnrichedChallenge extends ActiveChallenge {
  name: string;
  description: string;
  icon: string;
  target: number;
  xpReward: number;
  ipReward: number;
  tier: 'Daily' | 'Weekly' | 'Seasonal';
}

export interface ChallengesResponse {
  daily: EnrichedChallenge[];
  weekly: EnrichedChallenge[];
  seasonal: EnrichedChallenge[];
  dailyResetsAt: string;
  weeklyResetsAt: string;
  seasonEndsAt: string;
}

export interface Player {
  /** Stable unique ID for this player session (persists across reconnects) */
  id: string;
  /** Volatile socket ID (changes on every reconnect) */
  socketId: string;
  name: string;
  userId?: string;
  avatarUrl?: string;
  role?: Role;
  isAlive: boolean;
  isPresidentialCandidate: boolean;
  isChancellorCandidate: boolean;
  isPresident: boolean;
  isChancellor: boolean;
  wasPresident: boolean;
  wasChancellor: boolean;
  vote?: 'Aye' | 'Nay';
  isAI?: boolean;
  personality?: AIPersonality;
  activeFrame?: string;
  activePolicyStyle?: string;
  activeVotingStyle?: string;
  isDisconnected?: boolean;
  isReady?: boolean;
  hasActed?: boolean; // Track if player has acted in current phase
  titleRole?: TitleRole;
  titleUsed?: boolean;
  // Bayesian suspicion model: log-odds that each other player is State/Overseer
  suspicion?: { [playerId: string]: number };
  // How many State directives this player has enacted as Chancellor (observable)
  stateEnactments?: number;
  // How many Civil directives this player has enacted as Chancellor
  civilEnactments?: number;
  // Personal agenda assigned at game start
  personalAgenda?: PersonalAgendaId;
  alliances?: { [playerId: string]: number };
  difficulty?: 'Casual' | 'Normal' | 'Elite';
  isProvenNotOverseer?: boolean;
  isMicOn?: boolean;
  isCamOn?: boolean;
  assassinKilledId?: string;
  isLagging?: boolean;
  clanTag?: string; // populated from user.clan.tag at join time — display only
  clanEmblem?: ClanEmblem; // populated from user.clan.emblem at join time
  cipherUsed?: boolean;
  censureVoteId?: string;
}

export interface GameState {
  roomId: string;
  players: Player[];
  spectators: { id: string; name: string; avatarUrl?: string }[];
  spectatorQueue: {
    id: string;
    name: string;
    userId?: string;
    avatarUrl?: string;
    activeFrame?: string;
    activePolicyStyle?: string;
    activeVotingStyle?: string;
  }[];
  spectatorRoles?: {
    [playerId: string]: { role: string; titleRole?: string; agendaName?: string; agendaId?: string };
  };
  privacy: RoomPrivacy;
  inviteCode?: string; // only set when privacy === 'private'
  hostUserId?: string; // userId of the room creator
  isLocked?: boolean; // host has locked the room — no new joins
  mode: GameMode;
  phase: GamePhase;
  civilDirectives: number;
  stateDirectives: number;
  electionTracker: number;
  deck: Policy[];
  discard: Policy[];
  drawnPolicies: Policy[];
  chancellorPolicies: Policy[];
  currentExecutiveAction: ExecutiveAction;
  log: string[];
  winner?: 'Civil' | 'State';
  winReason?: string;
  presidentIdx: number;
  lastPresidentIdx: number;
  handlerSwapPending?: number; // countdown: 3=i2 next, 2=i1 next, 1=i3 next (revert before advancing)
  handlerSwapPositions?: [number, number]; // the two presidentialOrder positions to swap back
  chancellorId?: string;
  presidentId?: string;
  lobbyTimer?: number;
  isTimerActive?: boolean;
  maxPlayers: number;
  actionTimer: number;
  actionTimerEnd?: number;
  messages: {
    sender: string;
    text: string;
    timestamp: number;
    type?: 'text' | 'declaration' | 'round_separator' | 'failed_election' | 'system';
    declaration?: { civ: number; sta: number; type: 'President' | 'Chancellor' };
    round?: number;
  }[];
  investigationResult?: { targetName: string; role: Role };
  lastEnactedPolicy?: {
    type: Policy;
    timestamp: number;
    playerId?: string;
    historyCaptured?: boolean;
    trackerReady?: boolean;
    isChaos?: boolean;
  };
  round: number;
  presidentialOrder?: string[];
  rejectedChancellorId?: string;
  detainedPlayerId?: string;
  vetoUnlocked: boolean;
  vetoRequested: boolean;
  vetoDenied?: boolean;
  previousVotes?: { [playerId: string]: 'Aye' | 'Nay' };
  presidentSaw?: Policy[];
  chancellorSaw?: Policy[];
  presidentTimedOut?: boolean;
  chancellorTimedOut?: boolean;
  declarations: {
    playerId: string;
    playerName: string;
    civ: number; // what was passed (president) or received (chancellor)
    sta: number;
    drewCiv?: number; // president only: what they drew (3-card hand)
    drewSta?: number;
    type: 'President' | 'Chancellor';
    timestamp: number;
    isBlocked?: boolean;
  }[];
  isPaused?: boolean;
  pauseReason?: string;
  pauseTimer?: number;
  lobbyPauseTimer?: number;
  disconnectedPlayerId?: string;
  titlePrompt?: {
    playerId: string;
    role: TitleRole;
    context: TitlePromptContext;
    nextPhase?: GamePhase;
  };
  // Used by the Bayesian suspicion model: stores who voted how for the most
  // recently-formed government, and who was in it, so suspicion can be updated
  // once the enacted policy type is known (6s later during the animation).
  lastGovernmentVotes?: { [playerId: string]: 'Aye' | 'Nay' };
  lastGovernmentPresidentId?: string;
  lastGovernmentChancellorId?: string;
  lastExecutiveActionStateCount?: number;
  // Used by coordinated State AI lying: president stores the chancellor's intended claim
  pendingChancellorClaim?: { civ: number; sta: number };
  isStrategistAction?: boolean | undefined;
  // Structured per-round history for the history panel
  roundHistory?: {
    round: number;
    presidentName: string;
    chancellorName: string;
    presidentId?: string;
    chancellorId?: string;
    policy?: Policy;
    failed?: boolean;
    failReason?: 'vote' | 'veto';
    chaos?: boolean;
    votes: { playerId: string; playerName: string; vote: 'Aye' | 'Nay' }[];
    presDeclaration?: { civ: number; sta: number; drewCiv: number; drewSta: number };
    chanDeclaration?: { civ: number; sta: number };
    executiveAction?: string;
  }[];
  averageElo?: number;
  heraldLog?: { accuserId: string; targetId: string; claim: string; response: 'Confirmed' | 'Denied' }[];
  heraldPendingResponse?: { targetId: string; claim: string };
  isRevote?: boolean;
  quorumRevotePending?: boolean;
  snapElectionPhaseDone?: boolean;
  // Crisis mode event card flags
  activeEventCard?: EventCard;
  eventCardLog?: EventCardId[];
  electionTrackerFrozen?: boolean;
  openSession?: boolean;
  presidentDeclarationBlocked?: boolean;
  censureMotionActive?: boolean;
  censuredPlayerId?: string;
  ghostVoterId?: string;
  snapElectionActive?: boolean;
  doubleTrackerOnFail?: boolean;
  ironMandate?: boolean;
  chatBlackout?: boolean;
  snapElectionVolunteers?: string[];
  chatBlackoutBuffer?: { senderId: string; senderName: string; text: string; timestamp: number }[];
  spectatorPredictions?: {
    [userId: string]: { prediction: 'Civil' | 'State'; timestamp: number };
  };
  isPractice?: boolean;
  aiDifficulty?: 'Casual' | 'Normal' | 'Elite';
  activeCipherMessage?: { text: string; timestamp: number };
}

export interface ServerToClientEvents {
  reaction: (data: { playerId: string; reaction: string }) => void;
  gameStateUpdate: (state: GameState) => void;
  error: (message: string) => void;
  privateInfo: (info: {
    role: Role;
    stateAgents?: { id: string; name: string; role: Role }[];
  }) => void;
  investigationResult: (result: { targetName: string; role: Role }) => void;
  policyPeekResult: (policies: Policy[]) => void;
  voiceData: (data: { sender: string; data: ArrayBuffer }) => void;
  userUpdate: (user: User) => void;
  signal: (data: { from: string; signal: any }) => void;
  peerJoined: (peerId: string) => void;
  friendRequestReceived: (data: { fromUserId: string }) => void;
  friendRequestAccepted: (data: { fromUserId: string }) => void;
  userStatusChanged: (data: { userId: string; isOnline: boolean; roomId?: string }) => void;
  friendInvite: (data: { fromUserId: string; fromUsername: string; roomId: string }) => void;
  clanInviteReceived: (data: { inviteId: string; clanId: string; clanName: string; clanTag: string; fromUsername: string }) => void;
  clanMemberJoined: (data: { clanId: string; userId: string; username: string }) => void;
  clanXpUpdate: (data: { clanId: string; xp: number; level: number }) => void;
  powerUsed: (data: { role: string }) => void;
  queueDrained: () => void;
  postMatchResult: (result: PostMatchResult) => void;
  kicked: (reason?: string) => void;
  adminBroadcast: (data: { message: string; sender: string; timestamp: number }) => void;
  adminConfigUpdate: (config: SystemConfig) => void;
  adminChatLogs: (data: { roomId: string; logs: any[] }) => void;
  adminClearRedisSuccess: (message: string) => void;
  serverRestarting: (message: string) => void;
  hostChanged: (data: { newHostUserId: string }) => void;
  archivistResult: (discard: Policy[]) => void;
  heraldResponseRequired: (data: { targetId: string; claim: string }) => void;
  heraldRecord: (data: { accuserId: string; targetId: string; claim: string; response: 'Confirmed' | 'Denied' }) => void;
  cipherMessage: (data: { text: string }) => void;
  eventCardDrawn: (card: EventCard) => void;
  openSessionVotecast: (data: { playerId: string; vote: 'Aye' | 'Nay' }) => void;
  ghostVoteReveal: (data: { playerId: string; vote: 'Aye' | 'Nay' }) => void;
  blackoutReveal: (messages: { senderId: string; senderName: string; text: string; timestamp: number }[]) => void;
}

export interface ClientToServerEvents {
  sendReaction: (reaction: string) => void;
  setLagging: (isLagging: boolean) => void;
  'ping-server': (callback: () => void) => void;
  userConnected: (data: { userId: string; token: string }) => void;
  joinRoom: (data: {
    roomId: string;
    name: string;
    userId?: string;
    activeFrame?: string;
    activePolicyStyle?: string;
    activeVotingStyle?: string;
    maxPlayers?: number;
    actionTimer?: number;
    mode?: GameMode;
    isSpectator?: boolean;
    privacy?: RoomPrivacy;
    inviteCode?: string;
    avatarUrl?: string;
    isPractice?: boolean;
    aiDifficulty?: 'Casual' | 'Normal' | 'Elite';
  }) => void;
  leaveRoom: (data?: { intentional?: boolean }) => void;
  playAgain: () => void;
  startGame: () => void;
  toggleReady: () => void;
  startLobbyTimer: () => void;
  nominateChancellor: (chancellorId: string) => void;
  vote: (vote: 'Aye' | 'Nay') => void;
  presidentDiscard: (policyIdx: number) => void;
  chancellorPlay: (policyIdx: number) => void;
  performExecutiveAction: (targetId: string) => void;
  useTitleAbility: (abilityData: TitleAbilityData) => void;
  heraldResponse: (response: 'Confirmed' | 'Denied') => void;
  sendMessage: (message: string) => void;
  declarePolicies: (data: {
    civ: number;
    sta: number;
    drewCiv?: number;
    drewSta?: number;
    type: 'President' | 'Chancellor';
  }) => void;
  censureVote: (data: { targetId: string }) => void;
  snapVolunteer: () => void;
  vetoRequest: () => void;
  vetoResponse: (agree: boolean) => void;
  voiceData: (data: ArrayBuffer) => void;
  signal: (data: { to: string; signal: any; from: string }) => void;
  sendFriendRequest: (targetUserId: string) => void;
  acceptFriendRequest: (targetUserId: string) => void;
  joinQueue: (data: {
    name: string;
    userId?: string;
    avatarUrl?: string;
    activeFrame?: string;
    activePolicyStyle?: string;
    activeVotingStyle?: string;
  }) => void;
  leaveQueue: () => void;
  kickPlayer: (playerId: string) => void;
  toggleLock: () => void;
  hostStartGame: () => void;
  updateMediaState: (data: { isMicOn: boolean; isCamOn: boolean }) => void;
  adminDeleteRoom: (roomId: string) => void;
  adminBroadcast: (message: string) => void;
  adminUpdateUser: (data: {
    userId: string;
    updates: Partial<UserStats> & { isBanned?: boolean; cabinetPoints?: number };
  }) => void;
  adminUpdateConfig: (config: Partial<SystemConfig>) => void;
  adminGetChatLogs: (roomId: string) => void;
  adminClearRedis: () => void;
  spectatorPredict: (data: { prediction: 'Civil' | 'State' }) => void;
}
