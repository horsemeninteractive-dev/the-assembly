import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Trophy, Coins, Shield, User as UserIcon, Check, ShoppingBag, ArrowLeft, Star, Heart, Zap, Flame, Scroll, Play, Pause, Calendar, Clock, Target, ChevronDown, ChevronUp, Medal } from 'lucide-react';
import { User, CosmeticItem, Policy, MatchSummary } from '../types';
import { FriendsList } from './FriendsList';
import { Inventory } from './Inventory';
import { cn, getProxiedUrl } from '../lib/utils';
import { getPolicyStyles, getVoteStyles, getFrameStyles, getRarity } from '../lib/cosmetics';
import { DEFAULT_ITEMS, PASS_ITEM_LEVELS } from '../constants';
import { getLevelFromXp, getXpForNextLevel, getXpInCurrentLevel, getTotalXpForLevel } from '../lib/xp';
import { getRankTier, getRankLabel } from '../lib/ranks';
import { ACHIEVEMENT_DEFS, ACHIEVEMENT_MAP } from '../lib/achievements';

interface ProfileProps {
  user: User;
  onClose: () => void;
  onUpdateUser: (user: User) => void;
  token: string;
  playSound: (soundKey: string) => void;
  playMusic: (trackKey: string) => void;
  stopMusic: () => void;
  settings: {
    isMusicOn: boolean;
    setIsMusicOn: React.Dispatch<React.SetStateAction<boolean>>;
    isSoundOn: boolean;
    setIsSoundOn: React.Dispatch<React.SetStateAction<boolean>>;
    musicVolume: number;
    setMusicVolume: React.Dispatch<React.SetStateAction<number>>;
    soundVolume: number;
    setSoundVolume: React.Dispatch<React.SetStateAction<number>>;
    isFullscreen: boolean;
    setIsFullscreen: React.Dispatch<React.SetStateAction<boolean>>;
    ttsVoice: string;
    setTtsVoice: React.Dispatch<React.SetStateAction<string>>;
    ttsEngine: string;
    setTtsEngine: React.Dispatch<React.SetStateAction<string>>;
    isAiVoiceEnabled: boolean;
    setIsAiVoiceEnabled: React.Dispatch<React.SetStateAction<boolean>>;
    uiScaleSetting: number;
    setUiScaleSetting: React.Dispatch<React.SetStateAction<number>>;
    isLightMode: boolean;
    setIsLightMode: React.Dispatch<React.SetStateAction<boolean>>;
  };
  roomId?: string;
  onJoinRoom?: (roomId: string) => void;
  mode?: 'Casual' | 'Ranked';
}

export const Profile: React.FC<ProfileProps> = ({ user, onClose, onUpdateUser, token, playSound, playMusic, stopMusic, settings, roomId, onJoinRoom, mode }) => {
  const [activeTab, setActiveTab] = useState<'stats' | 'shop' | 'settings' | 'pass' | 'friends' | 'inventory' | 'history' | 'achievements'>('stats');
  const [shopCategory, setShopCategory] = useState<'frame' | 'policy' | 'vote' | 'music' | 'sound' | 'background'>('frame');
  const [settingsTab, setSettingsTab] = useState<'general' | 'audio' | 'voice'>('general');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [playingItemId, setPlayingItemId] = useState<string | null>(null);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [matchHistory, setMatchHistory] = useState<MatchSummary[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [expandedMatch, setExpandedMatch] = useState<string | null>(null);
  const [claimingReward, setClaimingReward] = useState<string | null>(null);
  const [justClaimed, setJustClaimed] = useState<string | null>(null);
  const [pinnedAchievements, setPinnedAchievements] = useState<string[]>(user.pinnedAchievements ?? []);
  const [pinSaving, setPinSaving] = useState(false);

  const savePins = async (pins: string[]) => {
    setPinSaving(true);
    try {
      const res = await fetch('/api/achievements/pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ pinnedAchievements: pins }),
      });
      if (res.ok) {
        const data = await res.json();
        onUpdateUser(data.user);
      }
    } finally {
      setPinSaving(false);
    }
  };

  const togglePin = (id: string) => {
    playSound('click');
    let next: string[];
    if (pinnedAchievements.includes(id)) {
      next = pinnedAchievements.filter(p => p !== id);
    } else if (pinnedAchievements.length < 3) {
      next = [...pinnedAchievements, id];
    } else {
      return; // already 3 pinned
    }
    setPinnedAchievements(next);
    savePins(next);
  };

  useEffect(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;

    const loadVoices = () => {
      const v = window.speechSynthesis.getVoices();
      if (v.length > 0) {
        setVoices(v);
      }
    };
    window.speechSynthesis.onvoiceschanged = loadVoices;
    loadVoices();
    
    // Retry for mobile browsers
    for (let i = 1; i <= 5; i++) {
      setTimeout(loadVoices, i * 500);
    }
  }, []);
  
  const playPreview = (item: CosmeticItem) => {
    if (playingItemId === item.id) {
      setPlayingItemId(null);
      // Stop preview, resume background music
      stopMusic();
      playMusic(user.activeMusic || 'music-ambient');
      return;
    }
    
    // Stop background music, play preview
    stopMusic();
    setPlayingItemId(item.id);
    
    if (item.type === 'sound') {
      // Play sound pack sequence
      const soundKeys = ['click', 'death', 'election_passed'];
      soundKeys.forEach((soundKey, index) => {
        setTimeout(() => playSound(soundKey), index * 1000);
      });
      setTimeout(() => setPlayingItemId(null), soundKeys.length * 1000);
    } else if (item.type === 'music') {
      playMusic(item.id);
    }
  };
  
  // Settings props destructuring
  const { 
    isMusicOn, setIsMusicOn, 
    isSoundOn, setIsSoundOn, 
    musicVolume, setMusicVolume, 
    soundVolume, setSoundVolume, 
    isFullscreen, setIsFullscreen, 
    ttsVoice, setTtsVoice, 
    ttsEngine, setTtsEngine,
    isAiVoiceEnabled, setIsAiVoiceEnabled,
    uiScaleSetting, setUiScaleSetting,
    isLightMode, setIsLightMode,
  } = settings;

  // Claim a pass reward — grants the item and adds to claimedRewards
  const handleClaim = async (rewardId: string, item?: CosmeticItem) => {
    setClaimingReward(rewardId);
    try {
      const response = await fetch('/api/pass/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ rewardId, itemId: item?.id }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      onUpdateUser(data.user);
      setJustClaimed(rewardId);
      setTimeout(() => setJustClaimed(null), 2000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setClaimingReward(null);
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const handleBuy = async (item: CosmeticItem) => {
    setIsLoading(true);
    setError('');
    try {
      const response = await fetch('/api/shop/buy', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ itemId: item.id, price: item.price }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      onUpdateUser(data.user);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEquip = async (type: 'frame' | 'badge' | 'policy' | 'vote' | 'music' | 'sound' | 'background', itemId: string | undefined) => {
    console.log('handleEquip called', type, itemId);
    setIsLoading(true);
    setError('');
    try {
      const body: any = {};
      if (type === 'frame') body.frameId = itemId || null;
      if (type === 'policy') body.policyStyle = itemId || null;
      if (type === 'vote') body.votingStyle = itemId || null;
      if (type === 'music') body.music = itemId === 'music-ambient' ? null : (itemId || null);
      if (type === 'sound') body.soundPack = itemId || null;
      if (type === 'background') body.backgroundId = itemId || null;

      const response = await fetch('/api/profile/frame', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      onUpdateUser(data.user);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch match history when tab is opened
  useEffect(() => {
    if (activeTab !== 'history' || matchHistory.length > 0) return;
    setHistoryLoading(true);
    fetch(`/api/match-history/${user.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(data => { if (data.history) setMatchHistory(data.history); })
      .catch(() => {})
      .finally(() => setHistoryLoading(false));
  }, [activeTab]);

  const winRate = user.stats.gamesPlayed > 0 
    ? Math.round((user.stats.wins / user.stats.gamesPlayed) * 100) 
    : 0;

  const filteredItems = DEFAULT_ITEMS.filter(item => 
    item.type === shopCategory && 
    !PASS_ITEM_LEVELS[item.id] && 
    !item.id.endsWith('-default')
  );

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-backdrop-heavy backdrop-blur-md"
      />
      
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        className="relative w-full max-w-4xl bg-surface border border-subtle rounded-[2rem] overflow-hidden shadow-2xl flex flex-col h-[85vh] max-h-[900px]"
      >
        {/* Header */}
        <div className="p-6 bg-elevated border-b border-subtle flex flex-col sm:flex-row items-center gap-6">
          <div className="relative">
            <div className="w-20 h-20 rounded-2xl bg-card border border-default flex items-center justify-center relative">
              <div className="w-16 h-16 rounded-2xl overflow-hidden">
                {user.avatarUrl ? (
                  <img src={getProxiedUrl(user.avatarUrl)} alt={user.username} className="w-full h-full object-cover" />
                ) : (
                  <UserIcon className="w-8 h-8 text-ghost" />
                )}
              </div>
              {user.activeFrame && (
                <div className={cn(
                  "absolute inset-1.5 border-4 rounded-2xl pointer-events-none",
                  getFrameStyles(user.activeFrame)
                )} />
              )}
            </div>
            <div className="absolute -bottom-1.5 -right-1.5 bg-red-900 border border-red-500 text-white text-[9px] font-mono px-1.5 py-0.5 rounded-lg shadow-lg">
              LVL {getLevelFromXp(user.stats.xp)}
            </div>
          </div>

          <div className="flex-1 text-center sm:text-left">
            <h2 className="text-2xl font-thematic text-primary tracking-wide mb-1">{user.username}</h2>
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              {/* Row 1: Rank */}
              <div className="flex justify-center sm:justify-start">
                <div className={cn('flex items-center gap-2 px-2 py-1 rounded-xl border', getRankTier(user.stats.elo).bg, getRankTier(user.stats.elo).border)}>
                  <span className="text-xs">{getRankTier(user.stats.elo).icon}</span>
                  <span className={cn('text-xs font-mono font-bold', getRankTier(user.stats.elo).color)}>{getRankLabel(user.stats.elo)}</span>
                  <span className="text-[10px] font-mono text-faint">· {user.stats.elo}</span>
                </div>
              </div>
              {/* Row 2: IP + CP */}
              <div className="flex justify-center sm:justify-start gap-2">
                <div className="flex items-center gap-2 px-2 py-1 bg-card rounded-xl border border-default">
                  <Coins className="w-3.5 h-3.5 text-emerald-500" />
                  <span className="text-xs font-mono text-emerald-500">{user.stats.points} IP</span>
                </div>
                <div className="flex items-center gap-2 px-2 py-1 bg-card rounded-xl border border-default">
                  <Zap className="w-3.5 h-3.5 text-purple-500" />
                  <span className="text-xs font-mono text-purple-500">{(user.cabinetPoints ?? 0)} CP</span>
                </div>
              </div>
              <div className="flex-1 max-w-[200px] sm:ml-2">
                <div className="flex justify-between text-[9px] text-gray-400 mb-0.5">
                  <span>XP</span>
                  <span>{getXpInCurrentLevel(user.stats.xp)} / {getXpForNextLevel(getLevelFromXp(user.stats.xp))}</span>
                </div>
                <div className="h-1.5 bg-card rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-red-600" 
                    style={{ width: `${Math.min(100, (getXpInCurrentLevel(user.stats.xp) / getXpForNextLevel(getLevelFromXp(user.stats.xp))) * 100)}%` }} 
                  />
                </div>
              </div>
            </div>
          </div>

          <button 
            onClick={() => {
              playSound('click');
              onClose();
            }}
            className="absolute top-4 right-4 p-2 text-ghost hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap border-b border-subtle">
          {[
            { id: 'stats', label: 'Stats' },
            { id: 'inventory', label: 'Inventory' },
            { id: 'achievements', label: 'Medals' },
            { id: 'shop', label: 'Shop' },
            { id: 'pass', label: 'Pass' },
            { id: 'friends', label: 'Friends' },
            { id: 'history', label: 'History' },
            { id: 'settings', label: 'Settings' }
          ].map((tab) => (
            <button 
              key={tab.id}
              onClick={() => { playSound('click'); setActiveTab(tab.id as any); }}
              className={cn(
                "flex-1 min-w-[80px] py-3 text-[10px] font-mono uppercase tracking-widest transition-all relative border-r border-subtle last:border-r-0", 
                activeTab === tab.id ? "text-primary bg-elevated/50" : "text-ghost hover:text-muted"
              )}
            >
              {tab.label}
              {activeTab === tab.id && <motion.div layoutId="tab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-red-500" />}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
          {activeTab === 'stats' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Rank tier card — spans full width on mobile, 1 col on larger */}
              <div className={cn('bg-elevated border rounded-3xl p-6 flex flex-col gap-2 sm:col-span-2 lg:col-span-3', getRankTier(user.stats.elo).border)}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl leading-none">{getRankTier(user.stats.elo).icon}</span>
                    <div>
                      <div className="text-[10px] font-mono text-muted uppercase tracking-widest mb-0.5">Ranked Rating</div>
                      <div className={cn('text-xl font-thematic uppercase tracking-wide leading-none', getRankTier(user.stats.elo).color)}>
                        {getRankLabel(user.stats.elo)}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-mono text-primary font-bold">{user.stats.elo}</div>
                    <div className="text-[10px] font-mono text-faint uppercase tracking-widest">ELO</div>
                  </div>
                </div>
                {/* Progress bar to next tier */}
                {(() => {
                  const tier = getRankTier(user.stats.elo);
                  const span = tier.maxElo - tier.minElo;
                  const pos  = user.stats.elo - tier.minElo;
                  const pct  = tier.name === 'Diamond' ? 100 : Math.round((pos / span) * 100);
                  const nextTier = tier.name === 'Diamond' ? null : ['Silver','Gold','Platinum','Diamond'][['Bronze','Silver','Gold','Platinum'].indexOf(tier.name)];
                  return (
                    <div className="space-y-1">
                      <div className="h-1.5 bg-card rounded-full overflow-hidden border border-subtle">
                        <div className={cn('h-full rounded-full transition-all', tier.bg.replace('/20', ''))} style={{ width: `${pct}%` }} />
                      </div>
                      {nextTier && <div className="text-[9px] font-mono text-faint text-right">{tier.maxElo - user.stats.elo} ELO to {nextTier}</div>}
                    </div>
                  );
                })()}
              </div>
              <StatCard label="Games Played" value={user.stats.gamesPlayed} icon={<Shield className="w-4 h-4" />} />
              <StatCard label="Win Rate" value={`${winRate}%`} icon={<Trophy className="w-4 h-4" />} />
              <StatCard label="Total Wins" value={user.stats.wins} icon={<Check className="w-4 h-4" />} />
              <StatCard label="Civil Games" value={user.stats.civilGames} icon={<Star className="w-4 h-4" />} />
              <StatCard label="State Games" value={user.stats.stateGames} icon={<Flame className="w-4 h-4" />} />
              <StatCard label="Overseer Games" value={user.stats.overseerGames} icon={<Shield className="w-4 h-4" />} />
              <StatCard label="Kills" value={user.stats.kills} icon={<Zap className="w-4 h-4 text-yellow-500" />} />
              <StatCard label="Deaths" value={user.stats.deaths} icon={<Heart className="w-4 h-4 text-red-500" />} />
              <StatCard label="Agendas Completed" value={user.stats.agendasCompleted || 0} icon={<Scroll className="w-4 h-4 text-emerald-500" />} />
              {user.createdAt && (
                <StatCard label="Account Created" value={new Date(user.createdAt).toLocaleDateString()} icon={<Calendar className="w-4 h-4 text-blue-500" />} />
              )}
            </div>
          ) : activeTab === 'friends' ? (
            <FriendsList user={user} token={token} playSound={playSound} roomId={roomId} onJoinRoom={onJoinRoom} mode={mode} />
          ) : activeTab === 'pass' ? (
            (() => {
              // Season 0 pass data
              const PASS_REWARDS: { level: number; rewardId: string; label: string; cp?: number; item?: any }[] = [
                { level: 10, rewardId: 'pass-0-lvl10', label: 'Geometric Grid', item: DEFAULT_ITEMS.find(i => i.id === 'bg-pass-0') },
                { level: 20, rewardId: 'pass-0-lvl20', label: 'Purple Rain', item: DEFAULT_ITEMS.find(i => i.id === 'vote-pass-0') },
                { level: 30, rewardId: 'pass-0-lvl30', label: '500 Cabinet Points', cp: 500 },
                { level: 40, rewardId: 'pass-0-lvl40', label: 'Static Noise', item: DEFAULT_ITEMS.find(i => i.id === 'music-pass-0') },
                { level: 50, rewardId: 'pass-0-lvl50', label: 'Purple Pill Frame', item: DEFAULT_ITEMS.find(i => i.id === 'frame-pass-0') },
              ];

              const currentLevel = getLevelFromXp(user.stats.xp);
              const xpInLevel   = getXpInCurrentLevel(user.stats.xp);
              const xpNeeded    = getXpForNextLevel(currentLevel);
              const xpProgress  = Math.min(100, Math.round((xpInLevel / xpNeeded) * 100));

              return (
                <div className="max-w-lg mx-auto space-y-6 pb-4">
                  {/* Season banner */}
                  <div className="relative overflow-hidden rounded-2xl border border-default bg-elevated p-5">
                    <div className="absolute inset-0 opacity-5" style={{ backgroundImage: 'url("/proxy?url=https%3A%2F%2Fwww.transparenttextures.com%2Fpatterns%2Fcarbon-fibre.png")' }} />
                    <div className="relative">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="text-[10px] font-mono text-muted uppercase tracking-[0.2em] mb-1">Assembly Pass</div>
                          <h3 className="text-2xl font-thematic text-primary tracking-wide uppercase leading-none">Season 0</h3>
                          <p className="text-xs text-faint font-mono mt-1">Calibration Season · Free Tier</p>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-3xl font-thematic text-yellow-500 leading-none">{currentLevel}</div>
                          <div className="text-[10px] font-mono text-muted uppercase tracking-widest">Level</div>
                        </div>
                      </div>
                      {/* XP progress bar */}
                      <div className="mt-4 space-y-1">
                        <div className="flex justify-between text-[10px] font-mono text-faint">
                          <span>{xpInLevel.toLocaleString()} XP</span>
                          <span>{xpNeeded.toLocaleString()} XP to level {currentLevel + 1}</span>
                        </div>
                        <div className="h-2 bg-card rounded-full overflow-hidden border border-subtle">
                          <div
                            className="h-full bg-gradient-to-r from-yellow-600 to-yellow-400 transition-all duration-700 rounded-full"
                            style={{ width: `${xpProgress}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Reward nodes */}
                  <div className="space-y-3">
                    {PASS_REWARDS.map((reward, idx) => {
                      const isUnlocked  = currentLevel >= reward.level;
                      const isClaimed   = user.claimedRewards.includes(reward.rewardId);
                      const canClaim    = isUnlocked && !isClaimed;
                      const isClaiming  = claimingReward === reward.rewardId;
                      const wasJustClaimed = justClaimed === reward.rewardId;

                      // XP progress toward this reward (for locked rewards)
                      const totalXpNeeded  = getTotalXpForLevel(reward.level);
                      const totalXpNow     = user.stats.xp;
                      const towardReward   = Math.min(100, Math.round((totalXpNow / totalXpNeeded) * 100));

                      return (
                        <div
                          key={reward.rewardId}
                          className={cn(
                            'rounded-2xl border p-4 transition-all',
                            isClaimed   ? 'border-subtle bg-card opacity-70'
                            : canClaim  ? 'border-yellow-500/50 bg-yellow-900/10 shadow-lg shadow-yellow-900/10'
                            : 'border-subtle bg-card'
                          )}
                        >
                          <div className="flex items-center gap-4">
                            {/* Level badge */}
                            <div className={cn(
                              'w-12 h-12 rounded-xl border-2 flex flex-col items-center justify-center shrink-0 transition-colors',
                              isClaimed  ? 'border-emerald-600/50 bg-emerald-900/20'
                              : canClaim ? 'border-yellow-500 bg-yellow-900/20 shadow-[0_0_12px_rgba(234,179,8,0.3)]'
                              : 'border-subtle bg-elevated'
                            )}>
                              {isClaimed ? (
                                <Check className="w-5 h-5 text-emerald-400" />
                              ) : (
                                <>
                                  <span className={cn('text-sm font-thematic leading-none', canClaim ? 'text-yellow-400' : 'text-muted')}>
                                    {reward.level}
                                  </span>
                                  <span className={cn('text-[8px] font-mono uppercase', canClaim ? 'text-yellow-500/70' : 'text-faint')}>LVL</span>
                                </>
                              )}
                            </div>

                            {/* Reward info */}
                            <div className="flex-1 min-w-0">
                              <div className={cn('text-sm font-medium mb-0.5', isClaimed ? 'text-muted' : 'text-primary')}>
                                {reward.label}
                              </div>
                              <div className="text-[10px] font-mono text-faint uppercase tracking-widest">
                                {reward.cp ? 'Cabinet Points' : reward.item?.type === 'background' ? 'Background' : reward.item?.type === 'vote' ? 'Vote Style' : reward.item?.type === 'music' ? 'Music Track' : reward.item?.type === 'frame' ? 'Avatar Frame' : 'Reward'}
                              </div>
                              {/* Progress bar for locked rewards */}
                              {!isUnlocked && (
                                <div className="mt-1.5 space-y-0.5">
                                  <div className="h-1 bg-elevated rounded-full overflow-hidden">
                                    <div className="h-full bg-yellow-600/50 rounded-full transition-all" style={{ width: `${towardReward}%` }} />
                                  </div>
                                  <div className="text-[9px] font-mono text-faint">
                                    {totalXpNow.toLocaleString()} / {totalXpNeeded.toLocaleString()} XP
                                  </div>
                                </div>
                              )}
                            </div>

                            {/* Item preview thumbnail */}
                            {reward.item && (
                              <div className="relative w-10 h-10 shrink-0">
                                <div className={cn('w-10 h-10 rounded-lg bg-card border overflow-hidden flex items-center justify-center', isUnlocked ? 'border-default' : 'border-subtle opacity-40 grayscale')}>
                                  {reward.item.type === 'music' ? (
                                    <button onClick={() => isUnlocked && playPreview(reward.item!)} className="w-full h-full flex items-center justify-center">
                                      {playingItemId === reward.item.id ? <Pause className="w-4 h-4 text-primary" /> : <Play className="w-4 h-4 text-primary" />}
                                    </button>
                                  ) : reward.item.type === 'frame' ? (
                                    <div className="relative w-full h-full">
                                      {user.avatarUrl ? <img src={getProxiedUrl(user.avatarUrl)} alt="" className="w-full h-full object-cover" /> : <UserIcon className="w-5 h-5 text-ghost" />}
                                      <div className={cn('absolute inset-0 border-2 rounded-lg pointer-events-none', getFrameStyles(reward.item.id))} />
                                    </div>
                                  ) : reward.item.type === 'vote' ? (
                                    <div className={cn('relative w-full h-full flex items-center justify-center overflow-hidden', getVoteStyles(reward.item.id, 'Aye'))}>
                                      {reward.item.id === 'vote-pass-0' && <div className="absolute inset-0 animate-purple-rain bg-purple-500/50 pointer-events-none" />}
                                      <span className="text-[9px] font-thematic uppercase relative z-10">AYE!</span>
                                    </div>
                                  ) : reward.item.type === 'background' ? (
                                    <div className="w-full h-full" style={{ backgroundImage: `url("${getProxiedUrl(reward.item.imageUrl!)}")`, backgroundSize: 'cover' }} />
                                  ) : null}
                                </div>
                              </div>
                            )}
                            {reward.cp && (
                              <div className={cn('w-10 h-10 rounded-lg border flex items-center justify-center shrink-0', isUnlocked ? 'bg-purple-900/20 border-purple-700/40' : 'bg-card border-subtle opacity-40 grayscale')}>
                                <Zap className="w-5 h-5 text-purple-400" />
                              </div>
                            )}

                            {/* Claim button */}
                            <div className="shrink-0 ml-2">
                              {isClaimed ? (
                                <span className="text-[10px] font-mono text-emerald-400 uppercase tracking-widest">Claimed</span>
                              ) : canClaim ? (
                                <button
                                  onClick={() => handleClaim(reward.rewardId, reward.item)}
                                  disabled={!!isClaiming}
                                  className={cn(
                                    'px-3 py-1.5 rounded-lg text-[10px] font-mono uppercase tracking-widest transition-all border',
                                    wasJustClaimed
                                      ? 'bg-emerald-900/30 border-emerald-600/50 text-emerald-400'
                                      : 'bg-yellow-500 border-yellow-400 text-black hover:bg-yellow-400 font-bold shadow-md shadow-yellow-900/20'
                                  )}
                                >
                                  {isClaiming ? '...' : wasJustClaimed ? '✓' : 'Claim'}
                                </button>
                              ) : (
                                <span className="text-[10px] font-mono text-faint uppercase tracking-widest">Locked</span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Season footer */}
                  <div className="text-center space-y-1 pt-2">
                    <p className="text-[10px] font-mono text-faint uppercase tracking-widest">Season 0 · Free Tier Only</p>
                    <p className="text-[9px] font-mono text-whisper">Premium Cabinet Points will be available in future seasons</p>
                  </div>
                </div>
              );
            })()
          ) : activeTab === 'inventory' ? (
            <Inventory 
              user={user} 
              onUpdateUser={onUpdateUser} 
              token={token} 
              playSound={playSound} 
              handleEquip={handleEquip} 
              items={DEFAULT_ITEMS}
              playPreview={playPreview}
              playingItemId={playingItemId}
            />
          ) : activeTab === 'shop' ? (
            <div className="space-y-8">
              {error && (
                <div className="text-red-500 text-xs text-center font-mono bg-red-900/10 py-3 rounded-xl border border-red-900/20">
                  {error}
                </div>
              )}

              {/* Shop Categories */}
              <div className="flex flex-col gap-2 w-full max-w-lg mx-auto mb-8">
                {/* Row 1 */}
                <div className="flex gap-1 sm:gap-2 p-1 bg-elevated rounded-2xl border border-subtle">
                  {[
                    { id: 'frame', label: 'Frames' },
                    { id: 'policy', label: 'Directives' },
                    { id: 'vote', label: 'Votes' }
                  ].map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => {
                        playSound('click');
                        setShopCategory(cat.id as any);
                      }}
                      className={cn(
                        "flex-1 px-3 sm:px-6 py-2 rounded-xl text-[9px] sm:text-[10px] font-mono uppercase tracking-widest transition-all whitespace-nowrap",
                        shopCategory === cat.id ? "bg-red-900 text-white" : "text-ghost hover:text-muted"
                      )}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
                {/* Row 2 */}
                <div className="flex gap-1 sm:gap-2 p-1 bg-elevated rounded-2xl border border-subtle">
                  {[
                    { id: 'music', label: 'Music' },
                    { id: 'sound', label: 'Sounds' },
                    { id: 'background', label: 'Backgrounds' }
                  ].map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => {
                        playSound('click');
                        setShopCategory(cat.id as any);
                      }}
                      className={cn(
                        "flex-1 px-3 sm:px-6 py-2 rounded-xl text-[9px] sm:text-[10px] font-mono uppercase tracking-widest transition-all whitespace-nowrap",
                        shopCategory === cat.id ? "bg-red-900 text-white" : "text-ghost hover:text-muted"
                      )}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredItems.map((item) => {
                  const isPassItem = !!PASS_ITEM_LEVELS[item.id];
                  const isUnlocked = isPassItem ? (Math.floor(user.stats.gamesPlayed / 5) + 1 >= PASS_ITEM_LEVELS[item.id]) : false;
                  const isOwned = user.ownedCosmetics.includes(item.id) || item.id === 'music-ambient' || isUnlocked;
                  const isEquipped = 
                    (item.type === 'frame' && user.activeFrame === item.id) ||
                    (item.type === 'policy' && user.activePolicyStyle === item.id) ||
                    (item.type === 'vote' && user.activeVotingStyle === item.id) ||
                    (item.type === 'music' && (user.activeMusic === item.id || (!user.activeMusic && item.id === 'music-ambient'))) ||
                    (item.type === 'sound' && user.activeSoundPack === item.id) ||
                    (item.type === 'background' && user.activeBackground === item.id);
                  
                  return (
                    <div key={item.id} className="bg-elevated border border-subtle rounded-3xl p-6 flex flex-col items-center text-center group">
                      <div className="relative w-20 h-20 mb-4">
                        <div className="w-20 h-20 rounded-2xl bg-card border border-default flex items-center justify-center">
                          {item.type === 'frame' ? (
                            user.avatarUrl ? <img src={getProxiedUrl(user.avatarUrl)} alt={user.username} className="w-full h-full object-cover" /> : <UserIcon className="w-10 h-10 text-ghost" />
                          ) : item.type === 'music' || item.type === 'sound' ? (
                            <button onClick={() => playPreview(item)} className="w-full h-full flex items-center justify-center">
                              {playingItemId === item.id ? <Pause className="w-8 h-8 text-primary" /> : <Play className="w-8 h-8 text-primary" />}
                            </button>
                          ) : item.type === 'policy' ? (
                            <div className={cn("w-full h-full flex flex-col items-center justify-center gap-1", getPolicyStyles(item.id, 'Civil'))}>
                              <Scroll className="w-8 h-8" />
                              <span className="text-[8px] font-mono uppercase">Civil</span>
                            </div>
                          ) : item.type === 'vote' ? (
                            <div className={cn("w-full h-full flex flex-col items-center justify-center gap-1", getVoteStyles(item.id, 'Aye'))}>
                              <span className="text-lg font-thematic uppercase">AYE!</span>
                              <span className="text-[8px] font-mono uppercase">YES</span>
                            </div>
                          ) : item.type === 'background' ? (
                            <div className="w-full h-full bg-elevated flex items-center justify-center">
                              <div className="w-full h-full opacity-50" style={{ backgroundImage: `url("${getProxiedUrl(item.imageUrl!)}")` }} />
                            </div>
                          ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center gap-1">
                              <span className="text-[8px] font-mono uppercase">{item.type}</span>
                            </div>
                          )}
                        </div>
                        {item.type === 'frame' && (
                          <div className={cn(
                            "absolute inset-0 border-4 rounded-2xl pointer-events-none",
                            getFrameStyles(item.id)
                          )} />
                        )}
                      </div>
                      <h4 className="font-serif italic text-lg mb-1 text-primary">{item.name}</h4>
                      <p className="text-[10px] text-muted font-mono uppercase mb-1">{item.type === 'policy' ? 'Directive Style' : `${item.type} Style`}</p>
                      <p className={cn("text-[9px] font-mono uppercase mb-2", getRarity(item.price).color)}>{getRarity(item.price).name}</p>
                      <p className="text-[10px] text-ghost font-sans mb-4 line-clamp-2">{item.description}</p>
                      
                      {isOwned ? (
                        <button 
                          disabled
                          className="w-full py-2 bg-card text-muted rounded-xl text-[10px] font-mono uppercase tracking-widest border border-default cursor-not-allowed"
                        >
                          Owned
                        </button>
                      ) : item.price === 0 ? (
                        <button 
                          disabled
                          className="w-full py-2 bg-card text-muted rounded-xl text-[10px] font-mono uppercase tracking-widest border border-default cursor-not-allowed"
                        >
                          Locked (Pass)
                        </button>
                      ) : (
                        <button 
                          onClick={() => {
                            playSound('click');
                            handleBuy(item);
                          }}
                          disabled={user.stats.points < item.price || isLoading}
                          className="w-full py-2 bg-red-900 text-white rounded-xl text-[10px] font-mono uppercase tracking-widest hover:bg-red-800 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                          <Coins className="w-3 h-3" />
                          {item.price} PTS
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : activeTab === 'achievements' ? ( (() => {
            const TIER_COLOURS: Record<string, { badge: string; row: string }> = {
              Bronze: {
                badge: 'bg-amber-900/30 border-amber-700/50 text-amber-600',
                row:   'border-amber-700/20 hover:bg-amber-900/10',
              },
              Silver: {
                badge: 'bg-slate-800/40 border-slate-500/50 text-slate-300',
                row:   'border-slate-700/20 hover:bg-slate-800/20',
              },
              Gold: {
                badge: 'bg-yellow-900/30 border-yellow-500/50 text-yellow-400',
                row:   'border-yellow-700/20 hover:bg-yellow-900/10',
              },
            };

            const earned = new Set<string>(
              (user.earnedAchievements ?? []).map((a: any) => typeof a === 'string' ? a : a.id)
            );
            const earnedTotal = earned.size;
            const totalAchievements = ACHIEVEMENT_DEFS.length;
            const categories = ['Milestone', 'Role', 'Title', 'Gameplay'] as const;

            return (
              <div className="space-y-8 max-w-2xl mx-auto pb-4">
                {/* Summary header */}
                <div className="bg-elevated border border-subtle rounded-2xl p-5 flex items-center gap-5">
                  <div className="w-14 h-14 rounded-2xl bg-yellow-900/20 border border-yellow-700/40 flex items-center justify-center shrink-0">
                    <Medal className="w-7 h-7 text-yellow-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted mb-1">Collection Progress</div>
                    <div className="text-xl font-thematic text-primary tracking-wide">
                      {earnedTotal} <span className="text-faint text-sm">/ {totalAchievements}</span>
                    </div>
                    <div className="mt-1.5 h-1.5 bg-card rounded-full overflow-hidden border border-subtle">
                      <div
                        className="h-full bg-yellow-500 rounded-full transition-all"
                        style={{ width: `${Math.round((earnedTotal / totalAchievements) * 100)}%` }}
                      />
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-2xl font-mono font-bold text-yellow-400">
                      {Math.round((earnedTotal / totalAchievements) * 100)}%
                    </div>
                    <div className="text-[9px] font-mono text-faint uppercase tracking-widest">complete</div>
                  </div>
                </div>

                {/* Pin hint */}
                <p className="text-[10px] font-mono text-faint text-center -mt-4">
                  Pin up to 3 medals to your public profile card.&nbsp;
                  {pinnedAchievements.length > 0
                    ? `${pinnedAchievements.length}/3 pinned.`
                    : 'Click an earned medal to pin it.'}
                  {pinSaving && <span className="text-yellow-400 ml-1">Saving…</span>}
                </p>

                {/* Achievements by category */}
                {categories.map(cat => {
                  const defs = ACHIEVEMENT_DEFS.filter(a => a.category === cat);
                  return (
                    <div key={cat}>
                      <div className="text-[9px] font-mono uppercase tracking-[0.25em] text-muted mb-3 border-b border-subtle pb-2">
                        {cat}
                      </div>
                      <div className="space-y-2">
                        {defs.map(def => {
                          const isEarned = earned.has(def.id);
                          const isPinned = pinnedAchievements.includes(def.id);
                          const tc = TIER_COLOURS[def.tier];
                          return (
                            <motion.div
                              key={def.id}
                              onClick={() => isEarned && togglePin(def.id)}
                              whileHover={isEarned ? { scale: 1.01 } : {}}
                              whileTap={isEarned ? { scale: 0.99 } : {}}
                              className={cn(
                                'flex items-center gap-3 px-4 py-3 rounded-xl border transition-all',
                                isEarned
                                  ? cn('cursor-pointer', tc.row)
                                  : 'border-subtle opacity-35 grayscale cursor-default',
                                isPinned && 'ring-1 ring-yellow-500/60'
                              )}
                            >
                              {/* Tier badge */}
                              <div className={cn('px-1.5 py-0.5 rounded text-[8px] font-mono font-bold uppercase tracking-widest border shrink-0', tc.badge)}>
                                {def.tier[0]}
                              </div>

                              {/* Name + description */}
                              <div className="flex-1 min-w-0">
                                <div className="text-[11px] font-bold text-primary tracking-wide uppercase">{def.name}</div>
                                <div className="text-[10px] text-ghost leading-tight truncate">{def.description}</div>
                              </div>

                              {/* Rewards */}
                              <div className="text-[9px] font-mono text-faint shrink-0 text-right hidden sm:block">
                                <div>+{def.xpReward} XP</div>
                                <div>+{def.cpReward} CP</div>
                              </div>

                              {/* Pin indicator */}
                              {isEarned && (
                                <div className={cn(
                                  'w-5 h-5 rounded-full border flex items-center justify-center shrink-0 transition-all',
                                  isPinned
                                    ? 'bg-yellow-500 border-yellow-400'
                                    : 'bg-card border-subtle'
                                )}>
                                  {isPinned && <Check className="w-3 h-3 text-black" />}
                                </div>
                              )}
                            </motion.div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()
          ) : activeTab === 'settings' ? (
            <div className="space-y-6 max-w-lg mx-auto">
              {/* Settings Sub-tabs */}
              <div className="flex gap-1 p-1 bg-elevated rounded-2xl border border-subtle mb-6">
                {[
                  { id: 'general', label: 'General' },
                  { id: 'audio', label: 'Audio' },
                  { id: 'voice', label: 'Voice' }
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => { playSound('click'); setSettingsTab(tab.id as any); }}
                    className={cn(
                      "flex-1 px-4 py-2 rounded-xl text-[10px] font-mono uppercase tracking-widest transition-all",
                      settingsTab === tab.id ? "bg-red-900 text-white shadow-lg" : "text-ghost hover:text-muted"
                    )}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="space-y-4">
                {settingsTab === 'general' && (
                  <>
                    <div className="flex items-center justify-between p-4 bg-elevated border border-subtle rounded-2xl">
                      <div>
                        <span className="text-sm font-mono text-primary">Light Mode</span>
                        <p className="text-[10px] font-mono text-muted uppercase mt-0.5">Switches to a light colour scheme</p>
                      </div>
                      <button onClick={() => setIsLightMode(!isLightMode)} className={cn("w-12 h-6 rounded-full transition-all relative shrink-0", isLightMode ? "bg-yellow-500" : "bg-subtle")}>
                        <div className={cn("absolute top-1 w-4 h-4 rounded-full bg-white transition-all", isLightMode ? "left-7" : "left-1")} />
                      </button>
                    </div>
                    <div className="flex items-center justify-between p-4 bg-elevated border border-subtle rounded-2xl">
                      <span className="text-sm font-mono text-primary">Fullscreen</span>
                      <button onClick={toggleFullscreen} className={cn("w-12 h-6 rounded-full transition-all relative", isFullscreen ? "bg-red-900" : "bg-subtle")}>
                        <div className={cn("absolute top-1 w-4 h-4 rounded-full bg-white transition-all", isFullscreen ? "left-7" : "left-1")} />
                      </button>
                    </div>
                    <div className="p-4 bg-elevated border border-subtle rounded-2xl space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-mono text-primary">UI Scale</span>
                        <span className="text-xs font-mono text-muted">{Math.round(uiScaleSetting * 100)}%</span>
                      </div>
                      <input 
                        type="range" 
                        min="0.5" 
                        max="1.5" 
                        step="0.05"
                        value={uiScaleSetting} 
                        onChange={(e) => setUiScaleSetting(parseFloat(e.target.value))} 
                        className="w-full accent-red-900" 
                      />
                      <p className="text-[10px] font-mono text-ghost uppercase">Adjusts the overall interface size</p>
                    </div>
                  </>
                )}

                {settingsTab === 'audio' && (
                  <>
                    <div className="flex items-center justify-between p-4 bg-elevated border border-subtle rounded-2xl">
                      <span className="text-sm font-mono text-primary">Music</span>
                      <button onClick={() => setIsMusicOn(!isMusicOn)} className={cn("w-12 h-6 rounded-full transition-all relative", isMusicOn ? "bg-red-900" : "bg-subtle")}>
                        <div className={cn("absolute top-1 w-4 h-4 rounded-full bg-white transition-all", isMusicOn ? "left-7" : "left-1")} />
                      </button>
                    </div>
                    <div className="p-4 bg-elevated border border-subtle rounded-2xl space-y-2">
                      <span className="text-sm font-mono text-primary">Music Volume</span>
                      <input type="range" min="0" max="100" value={musicVolume} onChange={(e) => setMusicVolume(parseInt(e.target.value))} className="w-full accent-red-900" />
                    </div>
                    <div className="flex items-center justify-between p-4 bg-elevated border border-subtle rounded-2xl">
                      <span className="text-sm font-mono text-primary">Sound Effects</span>
                      <button onClick={() => setIsSoundOn(!isSoundOn)} className={cn("w-12 h-6 rounded-full transition-all relative", isSoundOn ? "bg-red-900" : "bg-subtle")}>
                        <div className={cn("absolute top-1 w-4 h-4 rounded-full bg-white transition-all", isSoundOn ? "left-7" : "left-1")} />
                      </button>
                    </div>
                    <div className="p-4 bg-elevated border border-subtle rounded-2xl space-y-2">
                      <span className="text-sm font-mono text-primary">Sound Effects Volume</span>
                      <input type="range" min="0" max="100" value={soundVolume} onChange={(e) => setSoundVolume(parseInt(e.target.value))} className="w-full accent-red-900" />
                    </div>
                  </>
                )}

                {settingsTab === 'voice' && (
                  <>
                    <div className="flex items-center justify-between p-4 bg-elevated border border-subtle rounded-2xl">
                      <span className="text-sm font-mono text-primary">AI Voice Chat</span>
                      <button onClick={() => setIsAiVoiceEnabled(!isAiVoiceEnabled)} className={cn("w-12 h-6 rounded-full transition-all relative", isAiVoiceEnabled ? "bg-emerald-900" : "bg-subtle")}>
                        <div className={cn("absolute top-1 w-4 h-4 rounded-full bg-white transition-all", isAiVoiceEnabled ? "left-7" : "left-1")} />
                      </button>
                    </div>
                    <div className="p-4 bg-elevated border border-subtle rounded-2xl space-y-2">
                      <span className="text-sm font-mono text-primary">TTS Engine</span>
                      <select 
                        value={ttsEngine} 
                        onChange={(e) => setTtsEngine(e.target.value)}
                        className="w-full bg-card text-primary p-2 rounded-xl text-sm font-mono border border-default"
                      >
                        <option value="browser">Browser (Free, Offline)</option>
                        <option value="gemini">Gemini (High Quality, Free Tier)</option>
                      </select>
                    </div>
                    <div className="p-4 bg-elevated border border-subtle rounded-2xl space-y-2">
                      <span className="text-sm font-mono text-primary">TTS Voice</span>
                      <select 
                        value={ttsVoice} 
                        onChange={(e) => setTtsVoice(e.target.value)}
                        className="w-full bg-card text-primary p-2 rounded-xl text-sm font-mono border border-default"
                      >
                        <option value="">Default</option>
                        {voices.map(v => <option key={v.name} value={v.name}>{v.name} ({v.lang})</option>)}
                      </select>
                    </div>
                  </>
                )}
              </div>
            </div>
          ) : activeTab === 'history' ? (
            <div className="space-y-3">
              {historyLoading ? (
                <div className="flex items-center justify-center py-16 text-ghost font-mono text-xs uppercase tracking-widest">
                  Loading match history...
                </div>
              ) : matchHistory.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
                  <Clock className="w-10 h-10 text-whisper" />
                  <p className="text-ghost font-mono text-xs uppercase tracking-widest">No matches recorded yet</p>
                  <p className="text-whisper text-xs italic">Your game history will appear here after your first game.</p>
                </div>
              ) : matchHistory.map((match) => {
                const isExpanded = expandedMatch === match.id;
                const date = new Date(match.playedAt);
                const dateStr = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
                const timeStr = date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
                return (
                  <div
                    key={match.id}
                    className={cn(
                      'rounded-2xl border overflow-hidden transition-colors',
                      match.won ? 'border-emerald-900/40 bg-emerald-900/5' : 'border-red-900/30 bg-red-900/5'
                    )}
                  >
                    {/* Match summary row */}
                    <button
                      onClick={() => setExpandedMatch(isExpanded ? null : match.id)}
                      className="w-full flex items-center gap-4 p-4 text-left"
                    >
                      {/* Win/loss indicator */}
                      <div className={cn(
                        'w-10 h-10 rounded-xl flex items-center justify-center shrink-0 font-thematic text-xs uppercase tracking-widest',
                        match.won ? 'bg-emerald-900/30 text-emerald-400 border border-emerald-700/40' : 'bg-red-900/30 text-red-400 border border-red-700/40'
                      )}>
                        {match.won ? 'W' : 'L'}
                      </div>

                      {/* Core info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={cn(
                            'text-xs font-mono uppercase tracking-widest px-2 py-0.5 rounded border',
                            match.role === 'Civil' ? 'text-blue-400 bg-blue-900/20 border-blue-900/40'
                            : match.role === 'Overseer' ? 'text-red-500 bg-red-900/30 border-red-700/50 font-bold'
                            : 'text-red-400 bg-red-900/20 border-red-900/40'
                          )}>
                            {match.role}
                          </span>
                          <span className={cn(
                            'text-[10px] font-mono uppercase tracking-widest px-1.5 py-0.5 rounded border',
                            match.mode === 'Ranked' ? 'text-yellow-500 bg-yellow-900/10 border-yellow-900/30' : 'text-blue-400 bg-blue-900/10 border-blue-900/30'
                          )}>
                            {match.mode}
                          </span>
                          <span className="text-faint text-xs font-mono">{match.playerCount}p · R{match.rounds}</span>
                        </div>
                        <div className="text-muted text-xs mt-0.5 truncate">
                          {match.winReason || (match.won ? 'Victory' : 'Defeat')}
                        </div>
                      </div>

                      {/* Rewards */}
                      <div className="flex flex-col items-end gap-0.5 shrink-0">
                        <span className="text-emerald-400 text-[10px] font-mono">+{match.xpEarned} XP</span>
                        <div className="flex gap-1.5">
                          {match.ipEarned > 0 && <span className="text-yellow-400 text-[10px] font-mono">+{match.ipEarned} IP</span>}
                          {match.cpEarned > 0 && <span className="text-purple-400 text-[10px] font-mono">+{match.cpEarned} CP</span>}
                        </div>
                      </div>

                      {/* Expand chevron */}
                      <div className="text-faint ml-1 shrink-0">
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </div>
                    </button>

                    {/* Expanded details */}
                    <AnimatePresence initial={false}>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden"
                        >
                          <div className="px-4 pb-4 space-y-3 border-t border-white/5 pt-3">
                            {/* Policy track */}
                            <div className="flex gap-4">
                              <div className="flex-1 bg-surface rounded-xl p-3 border border-subtle">
                                <div className="text-faint text-[10px] font-mono uppercase tracking-widest mb-1">Civil Track</div>
                                <div className="flex items-center gap-2">
                                  <div className="flex gap-1">
                                    {Array.from({ length: 5 }).map((_, i) => (
                                      <div key={i} className={cn('w-5 h-5 rounded border', i < match.civilDirectives ? 'bg-blue-600 border-blue-500' : 'bg-card border-default')} />
                                    ))}
                                  </div>
                                  <span className="text-blue-400 text-xs font-mono">{match.civilDirectives}/5</span>
                                </div>
                              </div>
                              <div className="flex-1 bg-surface rounded-xl p-3 border border-subtle">
                                <div className="text-faint text-[10px] font-mono uppercase tracking-widest mb-1">State Track</div>
                                <div className="flex items-center gap-2">
                                  <div className="flex gap-1">
                                    {Array.from({ length: 6 }).map((_, i) => (
                                      <div key={i} className={cn('w-4 h-5 rounded border', i < match.stateDirectives ? 'bg-red-700 border-red-600' : 'bg-card border-default')} />
                                    ))}
                                  </div>
                                  <span className="text-red-400 text-xs font-mono">{match.stateDirectives}/6</span>
                                </div>
                              </div>
                            </div>

                            {/* Personal agenda */}
                            {match.agendaName && (
                              <div className={cn(
                                'rounded-xl p-3 border flex items-center gap-3',
                                match.agendaCompleted ? 'bg-emerald-900/10 border-emerald-700/30' : 'bg-surface border-subtle'
                              )}>
                                <Target className={cn('w-4 h-4 shrink-0', match.agendaCompleted ? 'text-emerald-400' : 'text-faint')} />
                                <div className="min-w-0">
                                  <div className="text-faint text-[10px] font-mono uppercase tracking-widest">Personal Agenda</div>
                                  <div className={cn('text-xs font-medium', match.agendaCompleted ? 'text-emerald-400' : 'text-tertiary')}>
                                    {match.agendaName} — {match.agendaCompleted ? 'Completed' : 'Failed'}
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* Date/time */}
                            <div className="text-ghost text-[10px] font-mono text-right">
                              {dateStr} at {timeStr}
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>
      </motion.div>
    </div>
  );
};

const StatCard = ({ label, value, icon }: { label: string; value: string | number; icon: React.ReactNode }) => (
  <div className="bg-elevated border border-subtle rounded-3xl p-6 flex flex-col gap-2">
    <div className="flex items-center gap-2 text-ghost">
      {icon}
      <span className="text-[10px] font-mono uppercase tracking-widest">{label}</span>
    </div>
    <div className="text-2xl font-serif italic text-primary">{value}</div>
  </div>
);
