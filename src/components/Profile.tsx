import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Trophy,
  ShoppingBag,
  ArrowLeft,
  Medal,
  Play,
  Pause,
  Clock,
  Pencil,
  Check,
  Shield,
  User as UserIcon,
  Star,
  Coins,
  Zap,
  Share2,
  Copy,
  Twitter,
  MessageCircle,
} from 'lucide-react';
import { User, CosmeticItem, GameMode } from '../../shared/types';
import { cn, getProxiedUrl, apiUrl } from '../utils/utils';
import { getFrameStyles } from '../utils/cosmetics';
import { getLevelFromXp, getXpInCurrentLevel, getXpForNextLevel } from '../utils/xp';
import { getRankTier, getRankLabel } from '../utils/ranks';

import { StatsTab } from './profile/StatsTab';
import { ShopTab } from './profile/ShopTab';
import { MedalsTab } from './profile/MedalsTab';
import { PassTab } from './profile/PassTab';
import { SettingsTab } from './profile/SettingsTab';
import { HistoryTab } from './profile/HistoryTab';
import { InventoryTab as Inventory } from './profile/InventoryTab';
import { FriendsList } from './profile/FriendsTab';
import { AdminTools } from './profile/AdminTab';
import { ChallengesTab } from './profile/ChallengesTab';
import { ClanTab } from './profile/ClanTab';

import { useTranslation, Trans } from '../contexts/I18nContext';
interface ProfileProps {
  user: User;
  onClose: () => void;
  onOpenPurchase: () => void;
  onUpdateUser: (user: User) => void;
  token: string;
  playSound: (soundKey: string, overridePack?: string) => void;
  playMusic: (trackKey: string) => void;
  stopMusic: () => void;
  settings: any;
  roomId?: string;
  onJoinRoom?: (roomId: string) => void;
  mode?: GameMode;
}

export const Profile: React.FC<ProfileProps> = ({
  user,
  onClose,
  onOpenPurchase,
  onUpdateUser,
  token,
  playSound,
  playMusic,
  stopMusic,
  settings,
  roomId,
  onJoinRoom,
  mode,
}) => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<
    | 'stats'
    | 'shop'
    | 'settings'
    | 'pass'
    | 'friends'
    | 'clan'
    | 'inventory'
    | 'history'
    | 'achievements'
    | 'challenges'
    | 'admin'
    | 'referrals'
  >('stats');
  
  const [error, setError] = useState('');
  const [playingItemId, setPlayingItemId] = useState<string | null>(null);
  
  const [isEditingName, setIsEditingName] = useState(false);
  const [newName, setNewName] = useState(user.username);
  const [isSavingName, setIsSavingName] = useState(false);

  const [shareOpen, setShareOpen] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const shareRef = useRef<HTMLDivElement>(null);

  // Build the canonical public profile URL
  const _profileOrigin = (() => {
    const o = window.location.origin;
    if (o.startsWith('capacitor://') || o.startsWith('http://localhost') || o.startsWith('https://localhost')) {
      return 'https://theassembly.web.app';
    }
    return o;
  })();
  const profileUrl = `${_profileOrigin}/player/${encodeURIComponent(user.username)}`;

  // Close share sheet on outside click
  useEffect(() => {
    if (!shareOpen) return;
    const handler = (e: MouseEvent) => {
      if (shareRef.current && !shareRef.current.contains(e.target as Node)) {
        setShareOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [shareOpen]);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(profileUrl).then(() => {
      setShareCopied(true);
      playSound('election_passed');
      setTimeout(() => { setShareCopied(false); setShareOpen(false); }, 1800);
    });
  };

  const handleShareNative = () => {
    if (navigator.share) {
      navigator.share({
        title: `${user.username} on The Assembly`,
        text: `Check out ${user.username}'s player profile — ${getRankLabel(user.stats.elo)} with a ${user.stats.gamesPlayed > 0 ? Math.round((user.stats.wins / user.stats.gamesPlayed) * 100) : 0}% win rate!`,
        url: profileUrl,
      }).then(() => setShareOpen(false)).catch(() => {});
    }
  };

  const handleUpdateUsername = async () => {
    if (!newName || newName === user.username) {
      setIsEditingName(false);
      return;
    }
    if (newName.length < 3 || newName.length > 20) {
      setError(t('profile.username_update.error_length'));
      return;
    }
    setIsSavingName(true);
    setError('');
    try {
      const res = await fetch(apiUrl('/api/user/update-username'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ newUsername: newName }),
      });

      if (!res.ok) {
        const text = await res.text();
        let errorMsg = t('profile.username_update.failed');
        try {
          const json = JSON.parse(text);
          errorMsg = json.error || errorMsg;
        } catch (e) {
          errorMsg = text || `Error ${res.status}: ${res.statusText}`;
        }
        throw new Error(errorMsg);
      }

      const data = await res.json();

      if (typeof window !== 'undefined') {
        const storedToken = localStorage.getItem('th_token');
        if (storedToken && data.token) {
          localStorage.setItem('th_token', data.token);
        }
      }

      onUpdateUser(data.user);
      setIsEditingName(false);
      playSound('election_passed');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSavingName(false);
    }
  };

  const playPreview = (item: CosmeticItem) => {
    if (item.type === 'music') {
      if (playingItemId === item.id) {
        stopMusic();
        setPlayingItemId(null);
      } else {
        stopMusic();
        playMusic(item.id);
        setPlayingItemId(item.id);
      }
    } else if (item.type === 'sound') {
      playSound('message', item.id);
    }
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={() => {
          if (playingItemId) stopMusic();
          onClose();
        }}
        className="absolute inset-0 bg-backdrop-heavy backdrop-blur-md"
      />

      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        className="relative w-full max-w-4xl bg-surface border border-subtle rounded-3xl overflow-hidden shadow-2xl flex flex-col h-[85vh] max-h-[900px]"
      >
        {/* Header */}
        <div className="p-4 sm:p-6 bg-elevated border-b border-subtle flex flex-row items-center gap-4 sm:gap-6 relative">
          <div className="relative shrink-0">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-card border border-default flex items-center justify-center relative">
              <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-2xl overflow-hidden">
                {user.avatarUrl ? (
                  <img
                    src={getProxiedUrl(user.avatarUrl)}
                    alt={user.username}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <UserIcon className="w-8 h-8 text-ghost" />
                )}
              </div>
              {user.activeFrame && (
                <div
                  className={cn(
                    'absolute inset-1.5 border-4 rounded-2xl pointer-events-none',
                    getFrameStyles(user.activeFrame)
                  )}
                />
              )}
            </div>
            <div className="absolute -bottom-1.5 -right-1.5 bg-red-900 border border-red-500 text-white text-[9px] font-mono px-1.5 py-0.5 rounded-lg shadow-lg">
              {t('profile.lvl_label')} {getLevelFromXp(user.stats.xp)}
            </div>
          </div>

          <div className="flex-1 text-left min-w-0">
            <div className="flex items-center justify-start gap-2 mb-1">
              {isEditingName ? (
                <div className="flex items-center gap-2">
                  <input
                    autoFocus
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleUpdateUsername()}
                    className="bg-card border border-primary text-primary px-2 py-1 rounded-lg text-base sm:text-lg font-thematic focus:outline-none w-32 sm:w-48"
                    disabled={isSavingName}
                  />
                  <button
                    onClick={handleUpdateUsername}
                    disabled={isSavingName}
                    className="p-1.5 rounded-lg bg-emerald-900/20 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-900/40"
                  >
                    {isSavingName ? (
                      <Clock className="w-4 h-4 animate-spin" />
                    ) : (
                      <Check className="w-4 h-4" />
                    )}
                  </button>
                  <button
                    onClick={() => {
                      setIsEditingName(false);
                      setNewName(user.username);
                    }}
                    className="p-1.5 rounded-lg bg-red-900/20 border border-red-500/30 text-red-500 hover:bg-red-900/40"
                    disabled={isSavingName}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <>
                  <h2 className="text-xl sm:text-2xl font-thematic text-primary tracking-wide truncate">
                    {user.username}
                  </h2>
                  <button
                    onClick={() => {
                      playSound('click');
                      setIsEditingName(true);
                      setError('');
                    }}
                    className="p-1 rounded-md text-ghost hover:text-primary hover:bg-white/5 transition-all"
                    title={t('profile.edit_username')}
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>

                  {/* Share Profile button + sheet */}
                  <div ref={shareRef} className="relative">
                    <button
                      onClick={() => { playSound('click'); setShareOpen((v) => !v); }}
                      title={t('profile.public_profile')}
                      className={cn(
                        'p-1 rounded-md transition-all',
                        shareOpen
                          ? 'text-primary bg-white/10'
                          : 'text-ghost hover:text-primary hover:bg-white/5'
                      )}
                    >
                      <Share2 className="w-3.5 h-3.5" />
                    </button>

                    <AnimatePresence>
                      {shareOpen && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.92, y: -4 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.92, y: -4 }}
                          transition={{ duration: 0.15 }}
                          className="absolute left-0 top-8 z-50 w-56 bg-elevated border border-subtle rounded-2xl shadow-2xl overflow-hidden"
                        >
                          {/* URL preview */}
                          <div className="px-3 pt-3 pb-2 border-b border-subtle">
                            <div className="text-[9px] font-mono uppercase tracking-widest text-faint mb-1">{t('profile.public_profile')}</div>
                            <div className="text-[10px] font-mono text-muted truncate">{profileUrl.replace('https://', '')}</div>
                          </div>

                          {/* Actions */}
                          <div className="p-1.5 space-y-0.5">
                            <button
                              onClick={handleCopyLink}
                              className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-mono text-secondary hover:text-primary hover:bg-white/5 transition-all text-left"
                            >
                              {shareCopied
                                ? <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                                : <Copy className="w-3.5 h-3.5 shrink-0" />}
                              {shareCopied ? t('profile.share.copied') : t('profile.share.copy_link')}
                            </button>

                            <a
                              href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(`Check out ${user.username}'s profile on The Assembly!`)}&url=${encodeURIComponent(profileUrl)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={() => { playSound('click'); setShareOpen(false); }}
                              className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-mono text-secondary hover:text-primary hover:bg-white/5 transition-all"
                            >
                              <Twitter className="w-3.5 h-3.5 shrink-0" />
                              {t('profile.share.on_twitter')}
                            </a>

                            <a
                              href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(profileUrl)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={() => { playSound('click'); setShareOpen(false); }}
                              className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-mono text-secondary hover:text-primary hover:bg-white/5 transition-all"
                            >
                              <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                              </svg>
                              {t('profile.share.on_facebook')}
                            </a>

                            <a
                              href={`https://wa.me/?text=${encodeURIComponent(`Check out ${user.username}'s profile on The Assembly! ${profileUrl}`)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={() => { playSound('click'); setShareOpen(false); }}
                              className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-mono text-secondary hover:text-primary hover:bg-white/5 transition-all"
                            >
                              <MessageCircle className="w-3.5 h-3.5 shrink-0" />
                              {t('profile.share.on_whatsapp')}
                            </a>

                            {typeof navigator.share === 'function' && (
                              <button
                                onClick={handleShareNative}
                                className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-mono text-secondary hover:text-primary hover:bg-white/5 transition-all text-left"
                              >
                                <Share2 className="w-3.5 h-3.5 shrink-0" />
                                {t('profile.share.more')}
                              </button>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </>
              )}
              {error && isEditingName && (
                <span className="text-red-400 text-xs font-mono absolute top-2 right-4">
                  {error}
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {/* Rank */}
              <div
                className={cn(
                  'flex items-center gap-2 px-2 py-1 rounded-xl border shrink-0',
                  getRankTier(user.stats.elo).bg,
                  getRankTier(user.stats.elo).border
                )}
              >
                <span className="text-xs">{getRankTier(user.stats.elo).icon}</span>
                <span
                  className={cn('text-xs font-mono font-bold', getRankTier(user.stats.elo).color)}
                >
                  {getRankLabel(user.stats.elo)}
                </span>
                <span className="text-[10px] font-mono text-faint">· {user.stats.elo}</span>
              </div>

              {/* Currencies */}
              <div className="flex items-center gap-1.5 px-2 py-1 bg-card rounded-xl border border-default shrink-0">
                <Coins className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <span className="text-xs font-mono text-emerald-500 whitespace-nowrap">
                  {user.stats.points} {t('profile.ip_label')}
                </span>
              </div>
              <div className="flex items-center gap-1.5 px-2 py-1 bg-card rounded-xl border border-default shrink-0">
                <Zap className="w-3.5 h-3.5 text-purple-500 shrink-0" />
                <span className="text-xs font-mono text-purple-500 whitespace-nowrap">
                  {user.cabinetPoints ?? 0} {t('profile.cp_label')}
                </span>
              </div>
              <div className="w-full max-w-[200px] mt-1 sm:mt-0 sm:ml-2">
                <div className="flex justify-between text-[9px] text-gray-400 mb-0.5">
                  <span>{t('profile.xp_label')}</span>
                  <span>
                    {getXpInCurrentLevel(user.stats.xp)} /{' '}
                    {getXpForNextLevel(getLevelFromXp(user.stats.xp))}
                  </span>
                </div>
                <div className="h-1.5 bg-card rounded-full overflow-hidden">
                  <div
                    className="h-full bg-red-600"
                    style={{
                      width: `${Math.min(100, (getXpInCurrentLevel(user.stats.xp) / getXpForNextLevel(getLevelFromXp(user.stats.xp))) * 100)}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

          <button
            onClick={() => {
              playSound('click');
              if (playingItemId) stopMusic();
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
            { id: 'stats', label: t('profile.tabs.stats') },
            { id: 'inventory', label: t('profile.tabs.inventory') },
            { id: 'achievements', label: t('profile.tabs.achievements') },
            { id: 'challenges', label: t('profile.tabs.challenges') },
            { id: 'clan', label: t('profile.tabs.clan') },
            { id: 'shop', label: t('profile.tabs.shop') },
            { id: 'pass', label: t('profile.tabs.pass') },
            { id: 'friends', label: t('profile.tabs.friends') },
            { id: 'referrals', label: t('profile.tabs.referrals') },
            { id: 'history', label: t('profile.tabs.history') },
            { id: 'settings', label: t('profile.tabs.settings') },
            ...(user.isAdmin ? [{ id: 'admin', label: t('profile.tabs.admin') }] : []),
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                playSound('click');
                setActiveTab(tab.id as any);
              }}
              className={cn(
                'flex-1 min-w-[80px] py-3 text-[10px] font-mono uppercase tracking-widest transition-all relative border-r border-subtle last:border-r-0',
                activeTab === tab.id ? 'text-primary bg-elevated/50' : 'text-ghost hover:text-muted'
              )}
            >
              {tab.label}
              {activeTab === tab.id && (
                <motion.div
                  layoutId="tab"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-red-500"
                />
              )}
            </button>
          ))}
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-8 custom-scrollbar">
          {activeTab === 'stats' && <StatsTab user={user} />}
          {activeTab === 'history' && <HistoryTab user={user} token={token} playSound={playSound} />}
          {activeTab === 'achievements' && <MedalsTab user={user} token={token} onUpdateUser={onUpdateUser} playSound={playSound} />}
          {activeTab === 'challenges' && <ChallengesTab user={user} token={token} />}
          {activeTab === 'inventory' && <Inventory user={user} token={token} onUpdateUser={onUpdateUser} playSound={playSound} playPreview={playPreview} playingItemId={playingItemId} />}
          {activeTab === 'shop' && <ShopTab user={user} token={token} onUpdateUser={onUpdateUser} playSound={playSound} playPreview={playPreview} playingItemId={playingItemId} />}
          {activeTab === 'pass' && <PassTab user={user} token={token} onUpdateUser={onUpdateUser} playPreview={playPreview} playingItemId={playingItemId} setError={setError} />}
          {activeTab === 'friends' && <FriendsList user={user} token={token} roomId={roomId} onJoinRoom={onJoinRoom} mode={mode} playSound={playSound} />}
          {activeTab === 'clan' && <ClanTab user={user} token={token} onUpdateUser={onUpdateUser} playSound={playSound} />}
          {activeTab === 'settings' && <SettingsTab user={user} token={token} onUpdateUser={onUpdateUser} playSound={playSound} settings={settings} />}
          {activeTab === 'admin' && <AdminTools adminId={user.id} token={token} />}
          {activeTab === 'referrals' && <ReferralsTab user={user} playSound={playSound} />}
        </div>
      </motion.div>
    </div>
  );
};

function ReferralsTab({ user, playSound }: { user: User; playSound: (s: string) => void }) {
  const { t } = useTranslation();
  const [copied, setCopied] = React.useState(false);
  const refLink = `https://theassembly.web.app/register?ref=${user.referralCode || user.id.substring(0, 8).toUpperCase()}`;

  const copy = () => {
    navigator.clipboard.writeText(refLink);
    setCopied(true);
    playSound('click');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6 max-w-lg mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="text-center space-y-2 mb-8">
        <div className="w-16 h-16 bg-emerald-900/20 border border-emerald-500/30 rounded-3xl flex items-center justify-center mx-auto mb-4">
          <Share2 className="w-8 h-8 text-emerald-400" />
        </div>
        <h2 className="text-2xl font-bold tracking-tight text-primary">{t('profile.referrals.title')}</h2>
        <p className="text-sm text-muted max-w-md mx-auto">
          {t('profile.referrals.subtitle')}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4">
        <div className="p-6 bg-elevated border border-subtle rounded-3xl space-y-4 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <Zap className="w-24 h-24 text-yellow-400" />
          </div>
          <div className="relative">
            <h3 className="text-sm font-mono uppercase tracking-widest text-emerald-400 mb-1">{t('profile.referrals.active_reward')}</h3>
            <p className="text-lg font-semibold text-primary">150 {t('profile.cp_label')}</p>
            <p className="text-xs text-ghost mt-2 leading-relaxed">
              <Trans
                i18nKey="profile.referrals.reward_desc"
                values={{ amount: 150 }}
                components={{ 
                  1: <span className="text-primary font-bold underline" />, 
                  3: <span className="text-yellow-400 font-bold" /> 
                }}
              />
            </p>
          </div>
        </div>

        <div className="p-6 bg-elevated border border-brand/20 rounded-3xl space-y-4 shadow-xl shadow-brand/5">
          <h3 className="text-xs font-mono uppercase tracking-widest text-faint">{t('profile.referrals.link_label')}</h3>
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-card border border-default px-4 py-3 rounded-2xl font-mono text-xs text-primary truncate">
              {refLink}
            </div>
            <button
              onClick={copy}
              className={cn(
                "p-3.5 rounded-2xl transition-all border",
                copied 
                  ? "bg-emerald-900/20 border-emerald-500/40 text-emerald-400 scale-95" 
                  : "bg-surface border-default text-ghost hover:text-primary hover:border-brand"
              )}
            >
              {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
            </button>
          </div>
          <p className="text-[10px] font-mono text-faint uppercase text-center">
            {copied ? t('profile.referrals.copied_hint') : t('profile.referrals.copy_hint')}
          </p>
        </div>
      </div>

      <div className="p-6 bg-surface/50 border border-dotted border-default rounded-3xl mt-4">
        <div className="flex items-start gap-3">
          <Clock className="w-5 h-5 text-ghost mt-0.5 shrink-0" />
          <div className="space-y-1">
            <p className="text-xs font-semibold text-muted">{t('profile.referrals.tracking_title')}</p>
            <p className="text-[11px] text-faint leading-relaxed">
              {t('profile.referrals.tracking_desc')}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
