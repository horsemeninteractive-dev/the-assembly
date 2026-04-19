import React, { useState, useEffect } from 'react';
import { useTranslation } from '../../contexts/I18nContext';
import { User, CosmeticItem } from '../../../shared/types';
import { DEFAULT_ITEMS, SEASON_PASS_CONTENT } from '../../sharedConstants';
import { getLevelFromXp, getXpInCurrentLevel, getXpForNextLevel, getTotalXpForLevel } from '../../utils/xp';
import { Check, Zap, Play, Pause, User as UserIcon, Lock, Clock, CalendarClock } from 'lucide-react';
import { cn, getProxiedUrl, apiUrl } from '../../utils/utils';
import { getVoteStyles, getFrameStyles } from '../../utils/cosmetics';
import { useGameContext } from '../../contexts/GameContext';

interface PassTabProps {
  user: User;
  token: string;
  onUpdateUser: (user: User) => void;
  playPreview: (item: CosmeticItem) => void;
  playingItemId: string | null;
  setError: (error: string) => void;
}

/** Format a duration (ms) into "Xd Xh Xm" or "Xh Xm Xs" when under 24h. */
function formatCountdown(ms: number): string {
  if (ms <= 0) return 'Ended';
  const totalSeconds = Math.floor(ms / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
  return `${minutes}m ${seconds}s`;
}

export function PassTab({ user, token, onUpdateUser, playPreview, playingItemId, setError }: PassTabProps) {
  const { t } = useTranslation();
  const { systemConfig } = useGameContext();
  const [claimingReward, setClaimingReward] = useState<string | null>(null);
  const [justClaimed, setJustClaimed] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<string>('');

  const currentSeasonNumber = systemConfig.currentSeasonNumber ?? 0;
  const currentSeasonPeriod = systemConfig.currentSeasonPeriod ?? `Season ${currentSeasonNumber}`;
  const currentSeasonEndsAt = systemConfig.currentSeasonEndsAt ?? '2026-05-02T00:00:00.000Z';

  // Live countdown ticker
  useEffect(() => {
    const tick = () => {
      const ms = new Date(currentSeasonEndsAt).getTime() - Date.now();
      setCountdown(formatCountdown(ms));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [currentSeasonEndsAt]);

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

  const currentLevel = getLevelFromXp(user.stats.xp);
  const xpInLevel = getXpInCurrentLevel(user.stats.xp);
  const xpNeeded = getXpForNextLevel(currentLevel);
  const xpProgress = Math.min(100, Math.round((xpInLevel / xpNeeded) * 100));

  const passRewards = SEASON_PASS_CONTENT[currentSeasonNumber];
  const hasContent = passRewards && passRewards.length > 0;

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
                {currentSeasonPeriod}
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

          {/* Season countdown */}
          <div className="mt-4 flex items-center gap-2 px-3 py-2 bg-card/60 rounded-xl border border-subtle w-fit">
            <CalendarClock className="w-3.5 h-3.5 text-muted shrink-0" />
            <span className="text-[10px] font-mono text-faint uppercase tracking-wider">
              {t('profile.pass.ends_in')}:
            </span>
            <span className="text-[10px] font-mono text-primary font-bold tabular-nums">
              {countdown}
            </span>
          </div>
        </div>
      </div>

      {/* Empty content placeholder */}
      {!hasContent && (
        <div className="flex flex-col items-center justify-center gap-4 py-16 rounded-2xl border border-dashed border-subtle bg-card/30">
          <div className="w-14 h-14 rounded-2xl bg-elevated border border-subtle flex items-center justify-center">
            <Clock className="w-7 h-7 text-ghost" />
          </div>
          <div className="text-center space-y-1">
            <p className="text-sm font-mono text-muted uppercase tracking-widest">
              {t('profile.pass.content_coming_soon')}
            </p>
            <p className="text-[11px] font-mono text-faint">
              {currentSeasonPeriod} {t('profile.pass.content_coming_desc')}
            </p>
          </div>
        </div>
      )}

      {/* Premium Unlock Card (Only show if doesn't have premium and pass exists) */}
      {hasContent && !user.premiumPassSeasons?.includes(currentSeasonNumber) && (
        <div className="relative overflow-hidden rounded-2xl border border-purple-500/30 bg-purple-900/10 p-5 group">
          <div className="absolute top-0 right-0 bg-purple-500 text-black text-[9px] font-bold py-1 px-4 rounded-bl-xl uppercase tracking-tighter">
            Premium Available
          </div>
          <div className="flex flex-col sm:flex-row items-center gap-5 relative z-10">
            <div className="w-16 h-16 rounded-2xl bg-purple-500/20 border border-purple-500/40 flex items-center justify-center shadow-[0_0_20px_rgba(168,85,247,0.2)] shrink-0">
              <Zap className="w-8 h-8 text-purple-400 animate-pulse" />
            </div>
            <div className="flex-1 text-center sm:text-left">
              <h4 className="text-lg font-thematic text-primary uppercase tracking-wide">
                Season 1: Premium Pass
              </h4>
              <p className="text-[11px] text-muted font-sans leading-relaxed mt-1">
                Unlock 10 extra cosmetic rewards and earn up to 1,200 CP back throughout the season.
              </p>
            </div>
            <div className="shrink-0">
              <button
                onClick={async () => {
                  if (currentSeasonNumber === 0) return; // Deactivated for S0
                  setClaimingReward('premium-unlock');
                  try {
                    const response = await fetch(apiUrl('/api/pass/unlock-premium'), {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                      body: JSON.stringify({ season: currentSeasonNumber }),
                    });
                    const data = await response.json();
                    if (!response.ok) throw new Error(data.error);
                    onUpdateUser(data.user);
                  } catch (err: any) {
                    setError(err.message);
                  } finally {
                    setClaimingReward(null);
                  }
                }}
                disabled={currentSeasonNumber === 0 || claimingReward === 'premium-unlock'}
                className={cn(
                  "px-6 py-3 rounded-xl font-thematic uppercase tracking-widest text-sm transition-all shadow-lg",
                  currentSeasonNumber === 0
                    ? "bg-surface-glass border border-subtle text-ghost cursor-not-allowed opacity-50"
                    : "bg-purple-500 text-black border-purple-400 hover:bg-purple-400 shadow-purple-900/20"
                )}
              >
                {currentSeasonNumber === 0 ? 'Season 1 Only' : claimingReward === 'premium-unlock' ? '...' : 'Unlock 1000 CP'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reward nodes */}
      {hasContent && (
        <div className="space-y-3">
          {passRewards.map((reward) => {
            const item = reward.itemId ? DEFAULT_ITEMS.find((i) => i.id === reward.itemId) : undefined;
            const isUnlocked = currentLevel >= reward.level;
            const isClaimed = user.claimedRewards?.includes(reward.rewardId);
            const isPremium = !!reward.isPremium;
            const hasPremium = user.premiumPassSeasons?.includes(currentSeasonNumber);
            
            const canClaim = isUnlocked && !isClaimed && (!isPremium || hasPremium);
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
                  isPremium && !hasPremium && 'opacity-60 saturate-[0.8]',
                  isClaimed
                    ? 'border-subtle bg-card opacity-70'
                    : canClaim
                      ? 'border-yellow-500/50 bg-yellow-900/10 shadow-lg shadow-yellow-900/10'
                      : isPremium && hasPremium
                        ? 'border-purple-500/30 bg-purple-900/5'
                        : 'border-subtle bg-card'
                )}
              >
                <div className="flex items-center gap-4">
                  {/* Level badge / Lock */}
                  <div
                    className={cn(
                      'w-12 h-12 rounded-xl border-2 flex flex-col items-center justify-center shrink-0 transition-colors',
                      isPremium && !hasPremium
                        ? 'border-subtle bg-surface-glass'
                        : isClaimed
                          ? 'border-emerald-600/50 bg-emerald-900/20'
                          : canClaim
                            ? 'border-yellow-500 bg-yellow-900/20 shadow-[0_0_12px_rgba(234,179,8,0.3)]'
                            : 'border-subtle bg-elevated'
                    )}
                  >
                    {isPremium && !hasPremium ? (
                      <Lock className="w-5 h-5 text-ghost" />
                    ) : isClaimed ? (
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
                    <div className="flex items-center gap-2 mb-0.5">
                      <div
                        className={cn(
                          'text-sm font-medium truncate',
                          isClaimed ? 'text-muted' : 'text-primary'
                        )}
                      >
                        {t(reward.labelKey, { count: reward.cp })}
                      </div>
                      {isPremium && (
                        <span className="text-[8px] font-bold bg-purple-500/20 text-purple-400 px-1.5 py-0.5 rounded uppercase tracking-tighter border border-purple-500/20">
                          Premium
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] font-mono text-faint uppercase tracking-widest">
                      {reward.cp
                        ? t('profile.pass.reward_types.cp')
                        : item?.type === 'background'
                          ? t('profile.pass.reward_types.background')
                          : item?.type === 'vote'
                            ? t('profile.pass.reward_types.vote')
                            : item?.type === 'music'
                              ? t('profile.pass.reward_types.music')
                              : item?.type === 'frame'
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
                  {item && (
                    <div className="relative w-10 h-10 shrink-0">
                      <div
                        className={cn(
                          'w-10 h-10 rounded-lg bg-card border overflow-hidden flex items-center justify-center',
                          isUnlocked ? 'border-default' : 'border-subtle opacity-40 grayscale'
                        )}
                      >
                        {item.type === 'music' ? (
                          <button
                            onClick={() => isUnlocked && playPreview(item!)}
                            className="w-full h-full flex items-center justify-center"
                          >
                            {playingItemId === item.id ? (
                              <Pause className="w-4 h-4 text-primary" />
                            ) : (
                              <Play className="w-4 h-4 text-primary" />
                            )}
                          </button>
                        ) : item.type === 'frame' ? (
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
                                getFrameStyles(item.id)
                              )}
                            />
                          </div>
                        ) : item.type === 'vote' ? (
                          <div
                            className={cn(
                              'relative w-full h-full flex items-center justify-center overflow-hidden',
                              getVoteStyles(item.id, 'Aye')
                            )}
                          >
                            {item.id === 'vote-pass-0' && (
                              <div className="absolute inset-0 animate-purple-rain bg-purple-500/50 pointer-events-none" />
                            )}
                            <span className="text-[9px] font-thematic uppercase relative z-10">
                              {t('common.aye') || 'AYE!'}
                            </span>
                          </div>
                        ) : item.type === 'background' ? (
                          item.id === 'bg-nebula-void' ? (
                            <div className="w-full h-full bg-nebula-void scale-[0.2] origin-center" />
                          ) : (
                            <div
                              className="w-full h-full"
                              style={{
                                backgroundImage: `url("${getProxiedUrl(item.imageUrl!)}")`,
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
                        onClick={() => handleClaim(reward.rewardId, item)}
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
      )}

      {/* Season footer */}
      <div className="text-center space-y-1 pt-2">
        <p className="text-[10px] font-mono text-faint uppercase tracking-widest">
          {t('profile.pass.footer_season', { number: currentSeasonNumber })}
        </p>
        <p className="text-[9px] font-mono text-whisper">
          {t('profile.pass.footer_premium_hint')}
        </p>
      </div>
    </div>
  );
}
