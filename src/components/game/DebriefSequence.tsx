/**
 * DebriefSequence.tsx
 *
 * Cinematic post-game debrief that plays before the GameOverModal.
 * Sequence:
 *   1. Intro  — winner announcement with faction colours
 *   2. Big Plays — key moments derived from roundHistory / player state
 *   3. Player Reveals — one player at a time, Civil → State → Overseer
 *   4. Finale — all players shown simultaneously, then onComplete fires
 *
 * Auto-advances per slide; tap / click anywhere to skip to the next slide.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Swords, Zap, AlertTriangle, Shield, Clock, Target, ChevronRight } from 'lucide-react';
import { GameState, Player, PrivateInfo } from '../../../shared/types';
import { cn, getProxiedUrl } from '../../utils/utils';
import { OverseerIcon } from '../icons';
import { extractBigPlays, BigPlay, BIG_PLAY_ICON } from '../../utils/game';
import { useTranslation } from '../../contexts/I18nContext';

type Slide =
  | { kind: 'intro' }
  | { kind: 'bigplays'; plays: BigPlay[] }
  | { kind: 'player'; player: Player; index: number; total: number }
  | { kind: 'finale' };

interface DebriefSequenceProps {
  gameState: GameState;
  privateInfo: PrivateInfo | null;
  myId: string | undefined;
  onComplete: () => void;
  playSound: (key: string) => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// ROLE_STYLE labels are now sourced from t() at render time — this object
// keeps only the visual tokens (colors, glows, ring colours).
const ROLE_STYLE = {
  Civil: {
    text: 'text-blue-500 dark:text-blue-400',
    border: 'border-blue-500/40 dark:border-blue-500/50',
    bg: 'bg-blue-500/10 dark:bg-blue-900/20',
    glow: '0 0 40px rgba(59,130,246,0.2)',
    ringColor: 'rgba(59,130,246,0.4)',
  },
  State: {
    text: 'text-red-500 dark:text-red-400',
    border: 'border-red-500/40 dark:border-red-500/50',
    bg: 'bg-red-500/10 dark:bg-red-900/20',
    glow: '0 0 40px rgba(239,68,68,0.25)',
    ringColor: 'rgba(239,68,68,0.45)',
  },
  Overseer: {
    text: 'text-red-600 dark:text-red-100',
    border: 'border-red-500/60 dark:border-red-400/70',
    bg: 'bg-red-500/15 dark:bg-red-900/40',
    glow: '0 0 60px rgba(239,68,68,0.4)',
    ringColor: 'rgba(239,68,68,0.7)',
  },
} as const;

/** Duration (ms) each slide auto-advances after. */
function slideDuration(slide: Slide): number {
  if (slide.kind === 'bigplays') return Math.max(3200, slide.plays.length * 1000 + 1200);
  if (slide.kind === 'player') return slide.player.role === 'Overseer' ? 3500 : 2600;
  if (slide.kind === 'finale') return 3000;
  return 3200; // intro
}


/** Returns players ordered Civil → State → Overseer (building to the reveal). */
function orderedPlayers(players: Player[]): Player[] {
  const roleOrder = { Civil: 0, State: 1, Overseer: 2 };
  return [...players].sort((a, b) => {
    const ra = roleOrder[a.role ?? 'Civil'] ?? 0;
    const rb = roleOrder[b.role ?? 'Civil'] ?? 0;
    return ra - rb;
  });
}

// ---------------------------------------------------------------------------
// Sub-slides
// ---------------------------------------------------------------------------

const IntroSlide = ({ gameState }: { gameState: GameState }) => {
  const { t } = useTranslation();
  const isCivil = gameState.winner === 'Civil';
  const color = isCivil ? 'text-blue-400' : 'text-red-500';
  const glow = isCivil
    ? 'drop-shadow-[0_0_30px_rgba(59,130,246,0.4)] dark:drop-shadow-[0_0_30px_rgba(59,130,246,0.6)]'
    : 'drop-shadow-[0_0_30px_rgba(239,68,68,0.4)] dark:drop-shadow-[0_0_30px_rgba(239,68,68,0.6)]';
  const subtitle = isCivil
    ? t('game.debrief.charter_defended')
    : t('game.debrief.secretariat_fallen');

  return (
    <div className="flex flex-col items-center justify-center gap-6 text-center px-8">
      <motion.p
        initial={{ opacity: 0, letterSpacing: '0.5em' }}
        animate={{ opacity: 1, letterSpacing: '0.25em' }}
        transition={{ duration: 1, delay: 0.2 }}
        className="text-[10px] font-mono uppercase tracking-[0.3em] text-muted"
      >
        {t('game.debrief.intro_title')}
      </motion.p>

      <motion.h1
        initial={{ opacity: 0, y: 20, scale: 0.95, letterSpacing: '0.4em' }}
        animate={{ opacity: 1, y: 0, scale: 1, letterSpacing: '0.15em' }}
        transition={{ duration: 1.6, delay: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className={cn('font-thematic text-4xl sm:text-5xl lg:text-7xl uppercase leading-tight px-4', color, glow)}
      >
        {(() => {
          const reason = gameState.winReason;
          if (!reason) return isCivil ? t('game.tracks.win_civil') : t('game.tracks.win_state');
          const map: Record<string, string> = {
            'CHARTER RESTORED': 'charter_restored',
            'STATE SUPREMACY': 'state_supremacy',
            'THE OVERSEER HAS BEEN EXECUTED': 'overseer_executed',
            'THE OVERSEER HAS ASCENDED': 'overseer_ascended'
          };
          const key = map[reason];
          return key ? t(`game.tracks.win_reasons.${key}`) : reason;
        })()}
      </motion.h1>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8, delay: 1.4 }}
        className="text-sm font-mono text-muted tracking-widest"
      >
        {subtitle}
      </motion.p>

      <motion.div
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ duration: 1, delay: 1.8 }}
        className={cn('h-px w-32 origin-center', isCivil ? 'bg-blue-500/40' : 'bg-red-500/40')}
      />
    </div>
  );
};

const BigPlaysSlide = ({ plays }: { plays: BigPlay[] }) => {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center gap-8 px-8 w-full max-w-lg">
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6 }}
        className="text-[10px] font-mono uppercase tracking-[0.3em] text-muted"
      >
        {t('game.debrief.key_moments')}
      </motion.p>
      <div className="w-full space-y-3">
        {plays.map((play, i) => {
          const Icon = BIG_PLAY_ICON[play.icon];
          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -24 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.3 + i * 0.25, ease: 'easeOut' }}
              className="flex items-center gap-4 bg-card/60 dark:bg-white/5 border border-default rounded-2xl px-5 py-4 backdrop-blur-sm"
            >
              <span className="text-secondary shrink-0">
                <Icon className="w-5 h-5" />
              </span>
              <p className="text-sm text-primary font-mono leading-snug">{play.text}</p>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};

const PlayerSlide = ({
  player,
  index,
  total,
  myId,
  agendaName,
  agendaId,
  agendaStatus,
}: {
  player: Player;
  index: number;
  total: number;
  myId: string | undefined;
  agendaName?: string;
  agendaId?: string;
  agendaStatus?: string;
}) => {
  const { t } = useTranslation();
  const role = player.role ?? 'Civil';
  const style = ROLE_STYLE[role] ?? ROLE_STYLE.Civil;
  const isMe = player.id === myId;
  const displayName = player.name.replace(' (AI)', '');
  const roleLabel = t(`game.debrief.roles.${role.toLowerCase()}`);

  return (
    <div className="flex flex-col items-center gap-6 px-8 text-center relative z-10 w-full h-full justify-center">
      {/* Intense red flash for Overseer reveal */}
      {role === 'Overseer' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0.4, 0] }}
          transition={{ delay: 1.1, duration: 1.5, ease: 'easeOut' }}
          className="fixed inset-0 bg-red-600 mix-blend-overlay pointer-events-none -z-10"
        />
      )}

      {/* Progress indicator */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="text-[9px] font-mono uppercase tracking-[0.3em] text-faint"
      >
        {index + 1} / {total}
      </motion.p>

      {/* Avatar with spotlight ring */}
      <motion.div
        initial={{ scale: 0.7, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        className="relative"
      >
        <div
          className="w-24 h-24 lg:w-32 lg:h-32 rounded-full overflow-hidden border-2 flex items-center justify-center bg-card text-2xl font-bold text-primary"
          style={{ borderColor: style.ringColor, boxShadow: style.glow }}
        >
          {player.avatarUrl ? (
            <img
              src={getProxiedUrl(player.avatarUrl)}
              alt={displayName}
              className="w-full h-full object-cover"
            />
          ) : (
            displayName.charAt(0).toUpperCase()
          )}
        </div>
        {player.isAI && (
          <span className="absolute -bottom-1 -right-1 text-[8px] font-mono bg-card border border-default rounded-full px-1.5 py-0.5 text-muted uppercase tracking-widest">
            AI
          </span>
        )}
      </motion.div>

      {/* Name */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.3 }}
        className="flex flex-col items-center gap-1"
      >
        <span className={cn('text-xl lg:text-2xl font-thematic tracking-wide', isMe && 'text-yellow-400')}>
          {displayName}
          {isMe && (
            <span className="ml-2 text-[10px] font-mono text-yellow-500/70 uppercase tracking-widest align-middle">
              {t('game.modals.game_over.you')}
            </span>
          )}
        </span>
      </motion.div>

      {/* Role reveal */}
      <motion.div
        initial={{ opacity: 0, scale: 0.8, y: 6 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ delay: 1.1, duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
        className={cn(
          'inline-flex items-center justify-center gap-1.5 px-5 py-2 rounded-xl border text-xs font-mono uppercase tracking-[0.2em] font-bold',
          style.text,
          style.border,
          style.bg
        )}
      >
        {role === 'Overseer' && <OverseerIcon className="w-4 h-4 shrink-0" />}
        <span>{roleLabel}</span>
      </motion.div>

      {/* Title role */}
      {player.titleRole && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.4 }}
          className="flex items-center gap-2 text-[10px] font-mono text-red-400/80 uppercase tracking-[0.2em]"
        >
          <Shield className="w-3 h-3" />
          {t(`game.titles.${player.titleRole.toLowerCase()}.name`)}
        </motion.div>
      )}

      {/* Personal agenda result (own player only) */}
      {agendaName && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.6 }}
          className={cn(
            'flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest px-3 py-1.5 rounded-lg border',
            agendaStatus === 'completed'
              ? 'text-emerald-400 border-emerald-500/30 bg-emerald-900/15'
              : agendaStatus === 'failed'
                ? 'text-red-400 border-red-500/20 bg-red-900/10'
                : 'text-muted border-default'
          )}
        >
          <Target className="w-3 h-3" />
          {agendaId ? t(`game.agendas.${agendaId}.name`) : agendaName}
          {agendaStatus === 'completed' && ` — ${t('game.modals.game_over.completed')}`}
          {agendaStatus === 'failed' && ` — ${t('game.modals.game_over.failed')}`}
        </motion.div>
      )}
    </div>
  );
};

const FinaleSlide = ({
  gameState,
  myId,
}: {
  gameState: GameState;
  myId: string | undefined;
}) => {
  const { t } = useTranslation();
  const sorted = orderedPlayers(gameState.players);

  return (
    <div className="flex flex-col items-center gap-6 px-6 w-full max-w-2xl">
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="text-[10px] font-mono uppercase tracking-[0.3em] text-muted"
      >
        {t('game.debrief.identities_confirmed')}
      </motion.p>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 w-full">
        {sorted.map((p, i) => {
          const role = p.role ?? 'Civil';
          const style = ROLE_STYLE[role] ?? ROLE_STYLE.Civil;
          const specInfo = gameState.spectatorRoles?.[p.id];
          const titleRole = specInfo?.titleRole || p.titleRole;
          const displayName = p.name.replace(' (AI)', '');

          return (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.07, duration: 0.4 }}
              className={cn(
                'flex flex-col items-center gap-2 p-3 rounded-2xl border',
                style.border,
                style.bg
              )}
            >
              <div
                className="w-10 h-10 rounded-full overflow-hidden border flex items-center justify-center text-xs font-bold text-primary bg-card"
                style={{ borderColor: style.ringColor }}
              >
                {p.avatarUrl ? (
                  <img src={getProxiedUrl(p.avatarUrl)} alt={displayName} className="w-full h-full object-cover" />
                ) : (
                  displayName.charAt(0).toUpperCase()
                )}
              </div>
              <span
                className={cn(
                  'text-[11px] font-medium text-center leading-tight truncate w-full text-center',
                  p.id === myId ? 'text-yellow-400' : 'text-secondary'
                )}
              >
                {displayName}
              </span>
              <span className={cn('text-[9px] font-mono uppercase tracking-widest font-bold', style.text)}>
                {t(`game.debrief.roles.${(role as string).toLowerCase()}`)}
              </span>
              {titleRole && (
                <span className="text-[8px] font-mono text-red-400/70 uppercase tracking-widest">
                  {t(`game.titles.${titleRole.toLowerCase()}.name`)}
                </span>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export const DebriefSequence = ({
  gameState,
  privateInfo,
  myId,
  onComplete,
  playSound,
}: DebriefSequenceProps) => {
  const { t } = useTranslation();
  // Build slide list once
  const slides = useMemo<Slide[]>(() => {
    const result: Slide[] = [{ kind: 'intro' }];

    const plays = extractBigPlays(gameState, t);
    if (plays.length > 0) result.push({ kind: 'bigplays', plays });

    const ordered = orderedPlayers(gameState.players);
    ordered.forEach((player, i) => {
      result.push({ kind: 'player', player, index: i, total: ordered.length });
    });

    result.push({ kind: 'finale' });
    return result;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const [step, setStep] = useState(0);
  const [exiting, setExiting] = useState(false);

  const advance = useCallback(() => {
    if (exiting) return;
    const next = step + 1;
    if (next >= slides.length) {
      setExiting(true);
      playSound('modal_close');
      setTimeout(onComplete, 600);
    } else {
      playSound('click');
      setStep(next);
    }
  }, [step, slides.length, exiting, onComplete, playSound]);

  // Auto-advance timer
  useEffect(() => {
    const current = slides[step];
    if (!current || exiting) return;
    const timer = setTimeout(advance, slideDuration(current));
    return () => clearTimeout(timer);
  }, [step, exiting, advance, slides]);

  const current = slides[step];

  // Resolve agenda info for the current player slide
  const { agendaName, agendaId } = (() => {
    if (current?.kind !== 'player') return { agendaName: undefined, agendaId: undefined };
    if (current.player.id === myId) {
      return { 
        agendaName: privateInfo?.personalAgenda?.name, 
        agendaId: privateInfo?.personalAgenda?.id 
      };
    }
    const spec = gameState.spectatorRoles?.[current.player.id];
    return { 
      agendaName: spec?.agendaName, 
      agendaId: spec?.agendaId 
    };
  })();
  const agendaStatus = (() => {
    if (current?.kind !== 'player' || current.player.id !== myId) return undefined;
    return privateInfo?.personalAgenda?.status;
  })();

  return (
    <AnimatePresence>
      {!exiting && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
          className="absolute inset-0 z-[60] flex flex-col items-center justify-center cursor-pointer select-none bg-backdrop backdrop-blur-xl"
          onClick={advance}
        >
          {/* Subtle spotlight */}
          <div
            className="absolute inset-0 pointer-events-none opacity-50 dark:opacity-100"
            style={{
              background:
                'radial-gradient(ellipse 50% 45% at 50% 45%, rgba(255,255,255,0.05) 0%, transparent 70%)',
            }}
          />

          {/* Slide content */}
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
              className="relative z-10 flex flex-col items-center justify-center w-full"
            >
              {current?.kind === 'intro' && <IntroSlide gameState={gameState} />}
              {current?.kind === 'bigplays' && <BigPlaysSlide plays={current.plays} />}
              {current?.kind === 'player' && (
                <PlayerSlide
                  player={current.player}
                  index={current.index}
                  total={current.total}
                  myId={myId}
                  agendaName={agendaName}
                  agendaId={agendaId}
                  agendaStatus={agendaStatus}
                />
              )}
              {current?.kind === 'finale' && <FinaleSlide gameState={gameState} myId={myId} />}
            </motion.div>
          </AnimatePresence>

          {/* Skip hint */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.5 }}
            className="absolute bottom-8 flex items-center gap-1.5 text-[9px] font-mono uppercase tracking-[0.25em] text-muted opacity-60 pointer-events-none"
          >
            {t('game.debrief.tap_to_advance')} <ChevronRight className="w-3 h-3" />
          </motion.div>

          {/* Progress dots */}
          <div className="absolute bottom-16 flex gap-1.5">
            {slides.map((_, i) => (
                <div
                  key={i}
                  className={cn(
                    'h-1 rounded-full transition-all duration-300',
                    i === step 
                      ? 'w-4 bg-gray-600 dark:bg-white/40' 
                      : i < step ? 'w-1 bg-gray-400 dark:bg-white/20' : 'w-1 bg-gray-300 dark:bg-white/10'
                  )}
                />
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
