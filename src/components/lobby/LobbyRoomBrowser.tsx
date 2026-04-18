import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Users,
  MessageSquare,
  LogOut,
  Lock,
  Users2,
  SlidersHorizontal,
} from 'lucide-react';
import { cn, getProxiedUrl } from '../../utils/utils';
import { RoomInfo, RoomPrivacy, GameMode } from '../../../shared/types';
import { useTranslation } from '../../contexts/I18nContext';

interface LobbyRoomBrowserProps {
  rooms: RoomInfo[];
  isLoading: boolean;
  rejoinInfo: {
    canRejoin: boolean;
    roomId?: string;
    roomName?: string;
    mode?: string;
  } | null;
  onJoinRoom: (
    roomId: string,
    maxPlayers?: number,
    actionTimer?: number,
    mode?: GameMode,
    isSpectator?: boolean,
    privacy?: RoomPrivacy,
    inviteCode?: string,
    avatarUrl?: string,
    isPractice?: boolean,
    aiDifficulty?: 'Casual' | 'Normal' | 'Elite'
  ) => void;
  playSound: (soundKey: string) => void;
  onOpenCreate: () => void;
}

// Colour map shared by filter chips and room card stripes
const MODE_STYLES: Record<string, { chip: string; chipOff: string; stripe: string }> = {
  Casual:  { chip: 'bg-blue-600   border-blue-400   text-white  shadow-[0_0_8px_rgba(37,99,235,0.4)]',  chipOff: '', stripe: 'bg-blue-500'    },
  Ranked:  { chip: 'bg-yellow-500 border-yellow-300 text-black  shadow-[0_0_8px_rgba(234,179,8,0.4)]',  chipOff: '', stripe: 'bg-yellow-500'  },
  Classic: { chip: 'bg-emerald-600 border-emerald-400 text-white shadow-[0_0_8px_rgba(5,150,105,0.4)]', chipOff: '', stripe: 'bg-emerald-500' },
  Crisis:  { chip: 'bg-purple-600 border-purple-400  text-white  shadow-[0_0_8px_rgba(147,51,234,0.4)]',chipOff: '', stripe: 'bg-purple-500'  },
};

export const LobbyRoomBrowser: React.FC<LobbyRoomBrowserProps> = ({
  rooms,
  isLoading,
  rejoinInfo,
  onJoinRoom,
  playSound,
  onOpenCreate,
}) => {
  const { t } = useTranslation();
  const [filterCasual,  setFilterCasual]  = useState(true);
  const [filterRanked,  setFilterRanked]  = useState(true);
  const [filterClassic, setFilterClassic] = useState(true);
  const [filterCrisis,  setFilterCrisis]  = useState(true);
  const [filterJoinable,    setFilterJoinable]    = useState(false);
  const [filterInProgress,  setFilterInProgress]  = useState(true);
  const [sortBy, setSortBy] = useState<'players' | 'newest'>('newest');
  const [invitePrompt, setInvitePrompt] = useState<{ roomId: string; roomName: string } | null>(null);
  const [inviteCodeInput, setInviteCodeInput] = useState('');

  const visibleRooms = (Array.isArray(rooms) ? rooms : [])
    .filter((room) => {
      if (!filterCasual  && room.mode === 'Casual')  return false;
      if (!filterRanked  && room.mode === 'Ranked')  return false;
      if (!filterClassic && room.mode === 'Classic') return false;
      if (!filterCrisis  && room.mode === 'Crisis')  return false;
      if (filterJoinable   && room.phase !== 'Lobby') return false;
      if (!filterInProgress && room.phase !== 'Lobby') return false;
      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'players') return b.playerCount - a.playerCount;
      return 0;
    });

  const clearFilters = () => {
    setFilterCasual(true);
    setFilterRanked(true);
    setFilterClassic(true);
    setFilterCrisis(true);
    setFilterJoinable(false);
    setFilterInProgress(true);
  };

  const modeFilters = [
    { label: t('game.modes.casual'),  active: filterCasual,  toggle: () => setFilterCasual(v => !v), raw: 'Casual' },
    { label: t('game.modes.ranked'),  active: filterRanked,  toggle: () => setFilterRanked(v => !v), raw: 'Ranked'  },
    { label: t('game.modes.classic'), active: filterClassic, toggle: () => setFilterClassic(v => !v), raw: 'Classic' },
    { label: t('game.modes.crisis'),  active: filterCrisis,  toggle: () => setFilterCrisis(v => !v), raw: 'Crisis'  },
  ];

  const phaseFilters = [
    {
      label: t('lobby.browser.filter_joinable'),
      active: filterJoinable,
      toggle: () => { setFilterJoinable(v => !v); if (!filterJoinable) setFilterInProgress(false); },
      activeClass: 'bg-emerald-600 border-emerald-400 text-white shadow-[0_0_8px_rgba(5,150,105,0.4)]',
    },
    {
      label: t('lobby.browser.filter_active'),
      active: filterInProgress,
      toggle: () => { setFilterInProgress(v => !v); if (!filterInProgress) setFilterJoinable(false); },
      activeClass: 'bg-red-600 border-red-400 text-white shadow-[0_0_8px_rgba(220,38,38,0.4)]',
    },
  ];

  // ── Rejoin banner (shared between both layouts) ──────────────────────
  const renderRejoinBanner = () => (
    <AnimatePresence>
      {rejoinInfo?.canRejoin && (
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -16 }}
          className="bg-red-900/20 border border-red-900/50 rounded-2xl p-3 flex flex-col sm:flex-row items-center justify-between gap-3 mx-0"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-red-900/20 rounded-xl flex items-center justify-center border border-red-500/30 shrink-0">
              <LogOut className="w-4 h-4 text-red-500 rotate-180" />
            </div>
            <div>
              <h3 className="text-sm font-serif italic text-primary">{t('lobby.browser.rejoin_title')}</h3>
              <p className="text-[9px] text-red-500/70 font-mono uppercase tracking-widest">
                {t('lobby.browser.rejoin_subtitle', { name: rejoinInfo.roomName })}
              </p>
            </div>
          </div>
          <button
            onClick={() => onJoinRoom(rejoinInfo.roomId!)}
            className="w-full sm:w-auto bg-red-600 text-white px-4 py-1.5 rounded-lg font-thematic text-sm hover:bg-red-500 transition-all shadow-lg shadow-red-900/20"
          >
            {t('lobby.browser.rejoin_btn')}
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );

  // ── Room card (shared between both layouts) ──────────────────────────
  const renderRoomCard = (room: RoomInfo, idx: number) => (
    <motion.div
      key={room.id}
      initial={{ opacity: 0, scale: 0.95, y: 16 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ delay: 0.05 + idx * 0.04, duration: 0.25, ease: 'easeOut' }}
      onMouseEnter={() => playSound('hover')}
      onClick={() => {
        playSound('click');
        if (room.privacy === 'private') {
          setInvitePrompt({ roomId: room.id, roomName: room.name });
        } else {
          onJoinRoom(room.id);
        }
      }}
      className="group relative bg-surface-glass border border-subtle rounded-2xl p-3 pl-[calc(12px+4px)] text-left transition-all hover:border-red-900/50 hover:shadow-xl hover:shadow-red-900/5 cursor-pointer overflow-hidden backdrop-blur-xl"
    >
      {/* Mode stripe */}
      <div className={cn('absolute left-0 top-0 bottom-0 w-[4px]', MODE_STYLES[room.mode]?.stripe ?? 'bg-blue-500')} />

      {/* Top row: status + mode badges */}
      <div className="flex items-start justify-between mb-2">
        <div className="flex flex-col gap-1">
          <div
            className={cn(
              'px-2 py-0.5 rounded-full text-[7px] font-mono uppercase tracking-widest border w-fit',
              room.phase === 'Lobby'
                ? 'bg-emerald-900/10 border-emerald-900/30 text-emerald-500'
                : 'bg-red-900/10 border-red-900/30 text-red-500'
            )}
          >
            {room.phase === 'Lobby' ? t('lobby.browser.status_recruiting') : t('lobby.browser.status_in_progress')}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <div
            className={cn(
              'px-2 py-0.5 rounded-full text-[7px] font-mono uppercase tracking-widest border',
              room.mode === 'Ranked'
                ? 'bg-yellow-900/10 border-yellow-900/30 text-yellow-500'
                : room.mode === 'Classic'
                  ? 'bg-emerald-900/10 border-emerald-900/30 text-emerald-500'
                  : room.mode === 'Crisis'
                    ? 'bg-purple-900/10 border-purple-900/30 text-purple-400'
                    : 'bg-blue-900/10 border-blue-900/30 text-blue-400'
            )}
          >
            {t(`game.modes.${room.mode.toLowerCase()}`)}
          </div>
          {room.privacy && room.privacy !== 'public' && (
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[7px] font-mono uppercase tracking-widest border bg-card border-subtle text-ghost">
              {room.privacy === 'private' ? <Lock className="w-2 h-2" /> : <Users2 className="w-2 h-2" />}
              {room.privacy === 'private' ? t('lobby.browser.privacy_private') : t('lobby.browser.privacy_friends')}
            </div>
          )}
          {room.isLocked && (
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[7px] font-mono uppercase tracking-widest border bg-red-900/20 border-red-900/40 text-red-400">
              <Lock className="w-2 h-2" />
              {t('lobby.browser.status_locked')}
            </div>
          )}
        </div>
      </div>

      {/* Room name */}
      <h3 className="text-sm font-serif italic mb-2 group-hover:text-white transition-colors leading-tight">
        {room.name}
      </h3>

      {/* Avatar stack */}
      <div className="flex -space-x-1.5 mb-2 overflow-hidden">
        {room.playerAvatars.slice(0, 5).map((avatar, i) => (
          <div key={i} className="w-6 h-6 rounded-full border border-deep bg-surface-glass overflow-hidden shrink-0">
            <img src={getProxiedUrl(avatar)} alt="Player" className="w-full h-full object-cover" />
          </div>
        ))}
        {room.playerAvatars.length > 5 && (
          <div className="w-6 h-6 rounded-full border border-deep bg-surface-glass flex items-center justify-center text-[7px] font-mono text-muted shrink-0">
            +{room.playerAvatars.length - 5}
          </div>
        )}
        <span className="ml-2 flex items-center text-[9px] font-mono text-muted">
          {t('lobby.browser.players_count', { count: room.playerCount, max: room.maxPlayers })}
        </span>
      </div>

      {/* Join / Spectate buttons */}
      <div className="flex gap-2">
        <button
          disabled={!!room.isLocked && room.phase === 'Lobby'}
          onClick={(e) => {
            e.stopPropagation();
            if (room.isLocked && room.phase === 'Lobby') return;
            playSound('click');
            if (room.privacy === 'private') {
              setInvitePrompt({ roomId: room.id, roomName: room.name });
            } else {
              onJoinRoom(room.id);
            }
          }}
          className={cn(
            'flex-1 py-1.5 text-[9px] font-mono uppercase tracking-widest rounded-lg transition-colors',
            room.isLocked && room.phase === 'Lobby'
              ? 'bg-card border border-subtle text-ghost cursor-not-allowed opacity-50'
              : 'btn-primary hover:bg-subtle'
          )}
        >
          {room.isLocked && room.phase === 'Lobby' ? t('lobby.browser.status_locked') : t('lobby.browser.btn_join')}
        </button>
        <button
          onMouseEnter={() => playSound('hover')}
          onClick={(e) => {
            e.stopPropagation();
            playSound('click');
            onJoinRoom(room.id, undefined, undefined, undefined, true);
          }}
          className="flex-1 py-1.5 bg-card text-primary text-[9px] font-mono uppercase tracking-widest rounded-lg border border-default hover:bg-subtle transition-colors"
        >
          {t('lobby.browser.btn_watch')}
        </button>
      </div>
    </motion.div>
  );

  // ── Empty state ──────────────────────────────────────────────────────
  const renderEmptyState = () => (
    <div className="col-span-full py-16 flex flex-col items-center justify-center text-center bg-surface-glass border border-dashed border-subtle rounded-2xl backdrop-blur-md">
      <MessageSquare className="w-10 h-10 text-whisper mb-3" />
      <p className="text-sm text-muted font-serif italic">
        {(Array.isArray(rooms) ? rooms.length : 0) === 0
          ? t('lobby.browser.empty_no_rooms')
          : t('lobby.browser.empty_no_match')}
      </p>
      {(Array.isArray(rooms) ? rooms.length : 0) === 0 ? (
        <button
          onClick={onOpenCreate}
          className="mt-3 text-[9px] text-red-500 font-mono uppercase tracking-widest hover:underline"
        >
          {t('lobby.browser.empty_create_prompt')}
        </button>
      ) : (
        <button
          onClick={clearFilters}
          className="mt-3 text-[9px] text-red-500 font-mono uppercase tracking-widest hover:underline"
        >
          {t('lobby.browser.empty_clear_filters')}
        </button>
      )}
    </div>
  );

  // ── Skeleton loaders ─────────────────────────────────────────────────
  const renderSkeletons = () => (
    <>
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="h-40 bg-surface-glass border border-subtle rounded-2xl animate-pulse" />
      ))}
    </>
  );

  return (
    <>
      {/* ── DESKTOP lg+: sticky filter bar + scrollable grid ── */}
      <div className="hidden lg:flex flex-col flex-1 min-h-0">

        {/* Sticky filter toolbar */}
        <div className="shrink-0 border-b border-subtle bg-base/85 backdrop-blur-2xl px-4 py-2 flex items-center gap-2 flex-wrap">
          <SlidersHorizontal className="w-3 h-3 text-muted shrink-0" />

          {modeFilters.map((f) => (
            <button
              key={f.raw}
              onMouseEnter={() => playSound('hover')}
              onClick={() => { playSound('click'); f.toggle(); }}
              className={cn(
                'px-2.5 py-1 rounded-full border text-[8px] font-mono uppercase tracking-widest transition-all shrink-0',
                f.active
                  ? MODE_STYLES[f.raw]?.chip
                  : 'border-subtle text-ghost bg-elevated hover:bg-surface'
              )}
            >
              {f.label}
            </button>
          ))}

          <div className="w-px h-3 bg-subtle shrink-0" />

          {phaseFilters.map((f) => (
            <button
              key={f.label}
              onMouseEnter={() => playSound('hover')}
              onClick={() => { playSound('click'); f.toggle(); }}
              className={cn(
                'px-2.5 py-1 rounded-full border text-[8px] font-mono uppercase tracking-widest transition-all shrink-0',
                f.active ? f.activeClass : 'border-subtle text-ghost bg-elevated hover:bg-surface'
              )}
            >
              {f.label}
            </button>
          ))}

          <div className="flex-1" />

          <span className="text-[8px] font-mono text-muted uppercase tracking-widest hidden sm:block">{t('lobby.browser.sort_label')}</span>
          {(['newest', 'players'] as const).map((s) => (
            <button
              key={s}
              onMouseEnter={() => playSound('hover')}
              onClick={() => { playSound('click'); setSortBy(s); }}
              className={cn(
                'px-2 py-1 rounded-lg border text-[8px] font-mono uppercase tracking-widest transition-all',
                sortBy === s
                  ? 'border-subtle bg-card text-primary'
                  : 'border-transparent text-ghost hover:text-muted'
              )}
            >
              {s === 'newest' ? t('lobby.browser.sort_new') : t('lobby.browser.sort_full')}
            </button>
          ))}
          <span className="text-[8px] font-mono text-faint pl-1">
            {visibleRooms.length}/{Array.isArray(rooms) ? rooms.length : 0}
          </span>
        </div>

        {/* Scrollable room grid */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
          <AnimatePresence>
            {rejoinInfo?.canRejoin && (
              <div className="mb-4">
                {renderRejoinBanner()}
              </div>
            )}
          </AnimatePresence>

          <div className="grid grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3 gap-3">
            {isLoading ? (
              renderSkeletons()
            ) : visibleRooms.length === 0 ? (
              renderEmptyState()
            ) : (
              visibleRooms.map((room, idx) => renderRoomCard(room, idx))
            )}
          </div>
        </div>
      </div>

      {/* ── MOBILE <lg: compact filter strip + room list ── */}
      <div className="lg:hidden flex flex-col gap-4">

        {renderRejoinBanner()}

        {/* Horizontally scrollable filter strip */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.35, ease: 'easeOut' }}
          className="flex items-center gap-2 overflow-x-auto whitespace-nowrap pb-1.5 pt-0.5 mt-2 mb-1 no-scrollbar bg-base/85 backdrop-blur-2xl rounded-xl"
        >
          <SlidersHorizontal className="w-3 h-3 text-muted shrink-0" />

          {modeFilters.map((f) => (
            <button
              key={f.raw}
              onClick={() => { playSound('click'); f.toggle(); }}
              className={cn(
                'px-2.5 py-1.5 rounded-lg border text-[8px] font-mono uppercase tracking-widest transition-all shrink-0 flex items-center gap-1.5 font-bold',
                f.active
                  ? `${MODE_STYLES[f.raw]?.chip} border-transparent`
                  : 'bg-elevated/40 border-subtle text-ghost hover:text-muted'
              )}
            >
              <div className={cn("w-1.5 h-1.5 rounded-full", 
                f.raw === 'Casual' ? 'bg-blue-400' :
                f.raw === 'Ranked' ? 'bg-yellow-400' :
                f.raw === 'Classic' ? 'bg-emerald-400' :
                'bg-purple-400'
              )} />
              {f.label}
            </button>
          ))}

          <div className="w-px h-3 bg-subtle shrink-0" />

          {phaseFilters.map((f) => (
            <button
              key={f.label}
              onClick={() => { playSound('click'); f.toggle(); }}
              className={cn(
                'px-2.5 py-1.5 rounded-lg border text-[8px] font-mono uppercase tracking-widest transition-all shrink-0 font-bold',
                f.active 
                  ? `${f.activeClass} border-transparent text-white` 
                  : 'bg-elevated/40 border-subtle text-ghost hover:text-muted'
              )}
            >
              {f.label}
            </button>
          ))}

          <div className="flex items-center gap-1 ml-auto shrink-0">
            {(['newest', 'players'] as const).map((s) => (
              <button
                key={s}
                onClick={() => { playSound('click'); setSortBy(s); }}
                className={cn(
                  'px-2 py-1 rounded-lg border text-[9px] font-mono uppercase tracking-widest transition-all',
                  sortBy === s
                    ? 'border-subtle bg-card text-primary'
                    : 'border-transparent text-ghost'
                )}
              >
                {s === 'newest' ? t('lobby.browser.sort_new') : t('lobby.browser.sort_full')}
              </button>
            ))}
            <span className="text-[9px] font-mono text-faint pl-1">
              {visibleRooms.length}/{Array.isArray(rooms) ? rooms.length : 0}
            </span>
          </div>
        </motion.div>

        {/* Room list — single column */}
        <div className="flex flex-col gap-3">
          {isLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-32 bg-surface-glass border border-subtle rounded-2xl animate-pulse" />
            ))
          ) : visibleRooms.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center text-center bg-surface-glass border border-dashed border-subtle rounded-2xl backdrop-blur-md">
              <MessageSquare className="w-8 h-8 text-whisper mb-3" />
              <p className="text-sm text-muted font-serif italic">
                {(Array.isArray(rooms) ? rooms.length : 0) === 0
                  ? t('lobby.browser.empty_no_rooms')
                  : t('lobby.browser.empty_no_match')}
              </p>
              {(Array.isArray(rooms) ? rooms.length : 0) === 0 ? (
                <button onClick={onOpenCreate} className="mt-3 text-[9px] text-red-500 font-mono uppercase tracking-widest hover:underline">
                  {t('lobby.browser.empty_create_prompt')}
                </button>
              ) : (
                <button onClick={clearFilters} className="mt-3 text-[9px] text-red-500 font-mono uppercase tracking-widest hover:underline">
                  {t('lobby.browser.empty_clear_filters')}
                </button>
              )}
            </div>
          ) : (
            visibleRooms.map((room, idx) => renderRoomCard(room, idx))
          )}
        </div>
      </div>

      {/* Invite Code Modal — shared */}
      <AnimatePresence>
        {invitePrompt && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => { setInvitePrompt(null); setInviteCodeInput(''); }}
              className="absolute inset-0 bg-backdrop backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-xs bg-surface-glass border border-subtle rounded-3xl p-6 shadow-2xl backdrop-blur-2xl"
            >
              <div className="flex flex-col items-center gap-4 text-center">
                <div className="w-12 h-12 bg-card rounded-2xl flex items-center justify-center border border-default">
                  <Lock className="w-6 h-6 text-muted" />
                </div>
                <div>
                  <h3 className="text-lg font-thematic text-primary uppercase tracking-wide">{t('lobby.browser.private_modal_title')}</h3>
                  <p className="text-xs text-muted font-mono mt-1">{invitePrompt.roomName}</p>
                  <p className="text-xs text-faint mt-1">{t('lobby.browser.private_modal_subtitle')}</p>
                </div>
                <input
                  autoFocus
                  type="text"
                  value={inviteCodeInput}
                  onChange={(e) => setInviteCodeInput(e.target.value.toUpperCase().slice(0, 6))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && inviteCodeInput.length === 6) {
                      onJoinRoom(invitePrompt.roomId, undefined, undefined, undefined, false, undefined, inviteCodeInput);
                      setInvitePrompt(null);
                      setInviteCodeInput('');
                    }
                  }}
                  placeholder="XXXXXX"
                  maxLength={6}
                  className="w-40 text-center text-xl font-mono tracking-[0.5em] bg-elevated border border-subtle rounded-xl py-3 text-primary focus:outline-none focus:border-red-500/50 uppercase transition-colors"
                />
                <div className="flex gap-3 w-full">
                  <button
                    onClick={() => { setInvitePrompt(null); setInviteCodeInput(''); }}
                    className="flex-1 py-2 border border-subtle text-muted text-xs font-mono uppercase tracking-widest rounded-xl hover:bg-card transition-colors"
                  >
                    {t('lobby.browser.private_modal_cancel')}
                  </button>
                  <button
                    disabled={inviteCodeInput.length !== 6}
                    onClick={() => {
                      onJoinRoom(invitePrompt.roomId, undefined, undefined, undefined, false, undefined, inviteCodeInput);
                      setInvitePrompt(null);
                      setInviteCodeInput('');
                    }}
                    className={cn(
                      'flex-1 py-2 text-xs font-mono uppercase tracking-widest rounded-xl transition-colors',
                      inviteCodeInput.length === 6
                        ? 'btn-primary hover:bg-subtle'
                        : 'bg-card text-ghost border border-subtle cursor-not-allowed'
                    )}
                  >
                    {t('lobby.browser.btn_join')}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};
