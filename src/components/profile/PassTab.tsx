import React, { useState } from 'react';
import { useTranslation } from '../../contexts/I18nContext';
import { User, CosmeticItem } from '../../../shared/types';
import { DEFAULT_ITEMS } from '../../sharedConstants';
import { getLevelFromXp, getXpInCurrentLevel, getXpForNextLevel, getTotalXpForLevel } from '../../utils/xp';
import { Check, Zap, Play, Pause, User as UserIcon } from 'lucide-react';
import { cn, getProxiedUrl, apiUrl } from '../../utils/utils';
import { getVoteStyles, getFrameStyles } from '../../utils/cosmetics';

interface PassTabProps {
  user: User;
  token: string;
  onUpdateUser: (user: User) => void;
  playPreview: (item: CosmeticItem) => void;
  playingItemId: string | null;
  setError: (error: string) => void;
}

export function PassTab({ user, token, onUpdateUser, playPreview, playingItemId, setError }: PassTabProps) {
  const { t } = useTranslation();
  const [claimingReward, setClaimingReward] = useState<string | null>(null);
  const [justClaimed, setJustClaimed] = useState<string | null>(null);

  const handleClaim = async (rewardId: string, item?: CosmeticItem) => {
    setClaimingReward(rewardId);
    try {
      const response = await fetch(apiUrl('/api/pass/claim'), {
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

  const PASS_REWARDS: {
    level: number;
    rewardId: string;
    label: string;
    cp?: number;
    item?: any;
  }[] = [
    {
      level: 10,
      rewardId: 'pass-0-lvl10',
      label: t('profile.pass.rewards.geometric_grid'),
      item: DEFAULT_ITEMS.find((i) => i.id === 'bg-pass-0'),
    },
    {
      level: 20,
      rewardId: 'pass-0-lvl20',
      label: t('profile.pass.rewards.purple_rain'),
      item: DEFAULT_ITEMS.find((i) => i.id === 'vote-pass-0'),
    },
    { level: 30, rewardId: 'pass-0-lvl30', label: t('profile.pass.reward_types.cp_count', { count: 500 }), cp: 500 },
    {
      level: 40,
      rewardId: 'pass-0-lvl40',
      label: t('profile.pass.rewards.static_noise'),
      item: DEFAULT_ITEMS.find((i) => i.id === 'music-pass-0'),
    },
    {
      level: 50,
      rewardId: 'pass-0-lvl50',
      label: t('profile.pass.rewards.purple_pill'),
      item: DEFAULT_ITEMS.find((i) => i.id === 'frame-pass-0'),
    },
  ];

  const currentLevel = getLevelFromXp(user.stats.xp);
  const xpInLevel = getXpInCurrentLevel(user.stats.xp);
  const xpNeeded = getXpForNextLevel(currentLevel);
  const xpProgress = Math.min(100, Math.round((xpInLevel / xpNeeded) * 100));

  return (
    <div className="max-w-lg mx-auto space-y-6 pb-4">
      {/* Season banner */}
      <div className="relative overflow-hidden rounded-2xl border border-default bg-elevated p-5">
        <div
          className="absolute inset-0 opacity-5"
          style={{
            backgroundImage: 'url("https://www.transparenttextures.com/patterns/carbon-fibre.png")',
          }}
        />
        <div className="relative">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-[10px] font-mono text-muted uppercase tracking-[0.2em] mb-1">
                {t('profile.pass.title')}
              </div>
              <h3 className="text-2xl font-thematic text-primary tracking-wide uppercase leading-none">
                {t('profile.pass.season', { number: 0 })}
              </h3>
              <p className="text-xs text-faint font-mono mt-1">{t('profile.pass.season_desc')}</p>
            </div>
            <div className="text-right shrink-0">
              <div className="text-3xl font-thematic text-yellow-500 leading-none">
                {currentLevel}
              </div>
              <div className="text-[10px] font-mono text-muted uppercase tracking-widest">
                {t('profile.pass.level')}
              </div>
            </div>
          </div>
          {/* XP progress bar */}
          <div className="mt-4 space-y-1">
            <div className="flex justify-between text-[10px] font-mono text-faint">
              <span>{t('profile.pass.xp_summary', { amount: xpInLevel.toLocaleString() })}</span>
              <span>
                {t('profile.pass.xp_to_next', { amount: xpNeeded.toLocaleString(), level: currentLevel + 1 })}
              </span>
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
          const isUnlocked = currentLevel >= reward.level;
          const isClaimed = user.claimedRewards.includes(reward.rewardId);
          const canClaim = isUnlocked && !isClaimed;
          const isClaiming = claimingReward === reward.rewardId;
          const wasJustClaimed = justClaimed === reward.rewardId;

          const totalXpNeeded = getTotalXpForLevel(reward.level);
          const totalXpNow = user.stats.xp;
          const towardReward = Math.min(100, Math.round((totalXpNow / totalXpNeeded) * 100));

          return (
            <div
              key={reward.rewardId}
              className={cn(
                'rounded-2xl border p-4 transition-all',
                isClaimed
                  ? 'border-subtle bg-card opacity-70'
                  : canClaim
                    ? 'border-yellow-500/50 bg-yellow-900/10 shadow-lg shadow-yellow-900/10'
                    : 'border-subtle bg-card'
              )}
            >
              <div className="flex items-center gap-4">
                {/* Level badge */}
                <div
                  className={cn(
                    'w-12 h-12 rounded-xl border-2 flex flex-col items-center justify-center shrink-0 transition-colors',
                    isClaimed
                      ? 'border-emerald-600/50 bg-emerald-900/20'
                      : canClaim
                        ? 'border-yellow-500 bg-yellow-900/20 shadow-[0_0_12px_rgba(234,179,8,0.3)]'
                        : 'border-subtle bg-elevated'
                  )}
                >
                  {isClaimed ? (
                    <Check className="w-5 h-5 text-emerald-400" />
                  ) : (
                    <>
                      <span
                        className={cn(
                          'text-sm font-thematic leading-none',
                          canClaim ? 'text-yellow-400' : 'text-muted'
                        )}
                      >
                        {reward.level}
                      </span>
                      <span
                        className={cn(
                          'text-[8px] font-mono uppercase',
                          canClaim ? 'text-yellow-500/70' : 'text-faint'
                        )}
                      >
                        {t('common.lvl')}
                      </span>
                    </>
                  )}
                </div>

                {/* Reward info */}
                <div className="flex-1 min-w-0">
                  <div
                    className={cn(
                      'text-sm font-medium mb-0.5',
                      isClaimed ? 'text-muted' : 'text-primary'
                    )}
                  >
                    {reward.label}
                  </div>
                  <div className="text-[10px] font-mono text-faint uppercase tracking-widest">
                    {reward.cp
                      ? t('profile.pass.reward_types.cp')
                      : reward.item?.type === 'background'
                        ? t('profile.pass.reward_types.background')
                        : reward.item?.type === 'vote'
                          ? t('profile.pass.reward_types.vote')
                          : reward.item?.type === 'music'
                            ? t('profile.pass.reward_types.music')
                            : reward.item?.type === 'frame'
                              ? t('profile.pass.reward_types.frame')
                              : t('profile.pass.reward_types.reward')}
                  </div>
                  {/* Progress bar for locked rewards */}
                  {!isUnlocked && (
                    <div className="mt-1.5 space-y-0.5">
                      <div className="h-1 bg-elevated rounded-full overflow-hidden">
                        <div
                          className="h-full bg-yellow-600/50 rounded-full transition-all"
                          style={{ width: `${towardReward}%` }}
                        />
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
                    <div
                      className={cn(
                        'w-10 h-10 rounded-lg bg-card border overflow-hidden flex items-center justify-center',
                        isUnlocked ? 'border-default' : 'border-subtle opacity-40 grayscale'
                      )}
                    >
                      {reward.item.type === 'music' ? (
                        <button
                          onClick={() => isUnlocked && playPreview(reward.item!)}
                          className="w-full h-full flex items-center justify-center"
                        >
                          {playingItemId === reward.item.id ? (
                            <Pause className="w-4 h-4 text-primary" />
                          ) : (
                            <Play className="w-4 h-4 text-primary" />
                          )}
                        </button>
                      ) : reward.item.type === 'frame' ? (
                        <div className="relative w-full h-full">
                          {user.avatarUrl ? (
                            <img
                              src={getProxiedUrl(user.avatarUrl)}
                              alt=""
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <UserIcon className="w-5 h-5 text-ghost" />
                          )}
                          <div
                            className={cn(
                              'absolute inset-0 border-2 rounded-lg pointer-events-none',
                              getFrameStyles(reward.item.id)
                            )}
                          />
                        </div>
                      ) : reward.item.type === 'vote' ? (
                        <div
                          className={cn(
                            'relative w-full h-full flex items-center justify-center overflow-hidden',
                            getVoteStyles(reward.item.id, 'Aye')
                          )}
                        >
                          {reward.item.id === 'vote-pass-0' && (
                            <div className="absolute inset-0 animate-purple-rain bg-purple-500/50 pointer-events-none" />
                          )}
                          <span className="text-[9px] font-thematic uppercase relative z-10">
                            {t('common.aye') || 'AYE!'}
                          </span>
                        </div>
                      ) : reward.item.type === 'background' ? (
                        reward.item.id === 'bg-nebula-void' ? (
                          <div className="w-full h-full bg-nebula-void scale-[0.2] origin-center" />
                        ) : (
                          <div
                            className="w-full h-full"
                            style={{
                              backgroundImage: `url("${getProxiedUrl(reward.item.imageUrl!)}")`,
                              backgroundSize: 'cover',
                            }}
                          />
                        )
                      ) : null}
                    </div>
                  </div>
                )}
                {reward.cp && (
                  <div
                    className={cn(
                      'w-10 h-10 rounded-lg border flex items-center justify-center shrink-0',
                      isUnlocked
                        ? 'bg-purple-900/20 border-purple-700/40'
                        : 'bg-card border-subtle opacity-40 grayscale'
                    )}
                  >
                    <Zap className="w-5 h-5 text-purple-400" />
                  </div>
                )}

                {/* Claim button */}
                <div className="shrink-0 ml-2">
                  {isClaimed ? (
                    <span className="text-[10px] font-mono text-emerald-400 uppercase tracking-widest">
                      {t('profile.pass.btn_claimed')}
                    </span>
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
                      {isClaiming ? '...' : wasJustClaimed ? '✓' : t('profile.pass.btn_claim')}
                    </button>
                  ) : (
                    <span className="text-[10px] font-mono text-faint uppercase tracking-widest">
                      {t('profile.pass.btn_locked')}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Season footer */}
      <div className="text-center space-y-1 pt-2">
        <p className="text-[10px] font-mono text-faint uppercase tracking-widest">
          {t('profile.pass.footer_season', { number: 0 })}
        </p>
        <p className="text-[9px] font-mono text-whisper">
          {t('profile.pass.footer_premium_hint')}
        </p>
      </div>
    </div>
  );
}


