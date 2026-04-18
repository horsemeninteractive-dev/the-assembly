import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Globe, Users2, Lock, Settings2 } from 'lucide-react';

import { cn } from '../../utils/utils';
import { RoomPrivacy, User } from '../../../shared/types';
import { useTranslation } from '../../contexts/I18nContext';

interface LobbyRoomCreatorProps {
  user: User;
  isOpen: boolean;
  onClose: () => void;
  onJoinRoom: (
    roomId: string,
    maxPlayers?: number,
    actionTimer?: number,
    mode?: import('../../../shared/types').GameMode,
    isSpectator?: boolean,
    privacy?: RoomPrivacy,
    inviteCode?: string,
    avatarUrl?: string,
    isPractice?: boolean,
    aiDifficulty?: 'Casual' | 'Normal' | 'Elite',
    houseRules?: import('../../../shared/types').HouseRules
  ) => void;
  playSound: (soundKey: string) => void;
  maintenanceMode?: boolean;
}

export const LobbyRoomCreator: React.FC<LobbyRoomCreatorProps> = ({
  user,
  isOpen,
  onClose,
  onJoinRoom,
  playSound,
  maintenanceMode,
}) => {
  const { t } = useTranslation();
  const [newRoomName, setNewRoomName] = useState('');
  const [maxPlayers, setMaxPlayers] = useState(5);
  const [actionTimer, setActionTimer] = useState(60);
  const [mode, setMode] = useState<import('../../../shared/types').GameMode>('Ranked');
  const [privacy, setPrivacy] = useState<RoomPrivacy>('public');
  
  // House Rules State
  const [civilDirectives, setCivilDirectives] = useState(6);
  const [stateDirectives, setStateDirectives] = useState(11);
  const [useTitleRoles, setUseTitleRoles] = useState(true);
  const [usePersonalAgendas, setUsePersonalAgendas] = useState(true);
  const [useCrisisCards, setUseCrisisCards] = useState(false);

  const handleCreateRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (newRoomName.trim()) {
      const houseRules = mode === 'House' ? {
        deckComposition: { civil: civilDirectives, state: stateDirectives },
        useTitleRoles,
        usePersonalAgendas,
        useCrisisCards
      } : undefined;

      onJoinRoom(newRoomName.trim(), maxPlayers, actionTimer, mode, false, privacy, undefined, undefined, false, 'Normal', houseRules);
      onClose();
    }
  };

  const modeDesc = (m: import('../../../shared/types').GameMode) => {
    switch (m) {
      case 'Ranked': return t('lobby.creator.mode_ranked_desc');
      case 'Classic': return t('lobby.creator.mode_classic_desc');
      case 'Crisis': return t('lobby.creator.mode_crisis_desc');
      case 'House': return t('lobby.creator.mode_house_desc');
      default: return t('lobby.creator.mode_casual_desc');
    }
  };

  const privacyOptions = [
    {
      value: 'public' as const,
      label: t('lobby.creator.privacy_public'),
      icon: <Globe className="w-3.5 h-3.5" />,
      desc: t('lobby.creator.privacy_public_desc'),
    },
    {
      value: 'friends' as const,
      label: t('lobby.creator.privacy_friends'),
      icon: <Users2 className="w-3.5 h-3.5" />,
      desc: t('lobby.creator.privacy_friends_desc'),
    },
    {
      value: 'private' as const,
      label: t('lobby.creator.privacy_private'),
      icon: <Lock className="w-3.5 h-3.5" />,
      desc: t('lobby.creator.privacy_private_desc'),
    },
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => {
              playSound('modal_close');
              onClose();
            }}
            className="absolute inset-0 bg-backdrop backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="relative w-full max-w-md bg-surface-glass border border-subtle rounded-3xl p-[4vh] shadow-2xl backdrop-blur-2xl"
          >
            <h2 className="text-responsive-xl font-serif italic mb-[3vh]">
              {t('lobby.creator.title')}
            </h2>
            <form onSubmit={handleCreateRoom} className="space-y-[2vh]">
              <div className="space-y-2">
                <label className="text-responsive-xs uppercase tracking-widest text-ghost font-mono ml-1">
                  {t('lobby.creator.room_name')}
                </label>
                <input
                  autoFocus
                  type="text"
                  value={newRoomName}
                  onChange={(e) => setNewRoomName(e.target.value)}
                  className="w-full bg-elevated border border-subtle rounded-xl py-[1.2vh] px-4 text-responsive-sm text-primary focus:outline-none focus:border-red-900/50 transition-colors"
                  placeholder={t('lobby.creator.room_name_placeholder')}
                  maxLength={40}
                  required
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between ml-1">
                  <label className="text-responsive-xs uppercase tracking-widest text-ghost font-mono">
                    {t('lobby.creator.max_players')}
                  </label>
                  <span className="text-responsive-sm font-mono text-red-500">{maxPlayers}</span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="10"
                  value={maxPlayers}
                  onChange={(e) => setMaxPlayers(parseInt(e.target.value))}
                  className="w-full h-1.5 bg-card rounded-lg appearance-none cursor-pointer accent-red-500"
                />
                <div className="flex justify-between text-[8px] text-ghost font-mono uppercase tracking-tighter">
                  <span>{t('lobby.creator.players_min')}</span>
                  <span>{t('lobby.creator.players_max')}</span>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between ml-1">
                  <label className="text-responsive-xs uppercase tracking-widest text-ghost font-mono">
                    {t('lobby.creator.action_timer')}
                  </label>
                  <span className="text-responsive-sm font-mono text-red-500">
                    {actionTimer === 0 ? t('lobby.creator.timer_off') : `${actionTimer}s`}
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="120"
                  step="15"
                  value={actionTimer}
                  onChange={(e) => setActionTimer(parseInt(e.target.value))}
                  className="w-full h-1.5 bg-card rounded-lg appearance-none cursor-pointer accent-red-500"
                />
                <div className="flex justify-between text-[8px] text-ghost font-mono uppercase tracking-tighter">
                  <span>{t('lobby.creator.timer_off')}</span>
                  <span>120s</span>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-responsive-xs uppercase tracking-widest text-ghost font-mono ml-1">
                  {t('lobby.creator.game_mode')}
                </label>
                <div className="flex gap-2">
                  {(['Ranked', 'Casual', 'Classic', 'Crisis', 'House'] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => { playSound('click'); setMode(m); }}
                      className={cn(
                        'flex-1 py-[1vh] rounded-xl border text-responsive-xs font-mono uppercase tracking-widest transition-all',
                        mode === m
                          ? m === 'Ranked' ? 'bg-yellow-900/20 border-yellow-500 text-yellow-500'
                            : m === 'Casual' ? 'bg-blue-900/20 border-blue-500 text-blue-400'
                            : m === 'Classic' ? 'bg-emerald-900/20 border-emerald-500 text-emerald-500'
                            : m === 'Crisis' ? 'bg-purple-900/20 border-purple-500 text-purple-400'
                            : 'bg-red-900/20 border-red-500 text-red-400 shadow-[0_0_15px_rgba(239,68,68,0.2)]'
                          : 'bg-elevated border-subtle text-ghost'
                      )}
                    >
                      {m}
                    </button>
                  ))}
                </div>
                <p className="text-[8px] text-ghost italic ml-1 pt-1">{modeDesc(mode)}</p>
              </div>

              {/* House Rules Configuration */}
              <AnimatePresence>
                {mode === 'House' && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="p-4 bg-red-950/10 border border-red-900/20 rounded-2xl space-y-4 mb-2">
                      <div className="flex items-center gap-2 mb-1">
                        <Settings2 className="w-3 h-3 text-red-400" />
                        <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-red-400">{t('lobby.creator.house_rules')}</span>
                      </div>

                      {/* Deck Composition */}
                      <div className="space-y-3">
                        <div className="flex justify-between text-[9px] font-mono text-ghost uppercase tracking-wider">
                          <span>{t('lobby.creator.deck_composition')}</span>
                          <span className="text-red-400">{civilDirectives}C / {stateDirectives}S</span>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <span className="text-[8px] text-ghost uppercase">{t('directives.civil')}</span>
                            <input
                              type="range"
                              min="0"
                              max="20"
                              value={civilDirectives}
                              onChange={(e) => setCivilDirectives(parseInt(e.target.value))}
                              className="w-full h-1 bg-red-900/20 rounded-full appearance-none cursor-pointer accent-blue-500"
                            />
                          </div>
                          <div className="space-y-1">
                            <span className="text-[8px] text-ghost uppercase">{t('directives.state')}</span>
                            <input
                              type="range"
                              min="0"
                              max="20"
                              value={stateDirectives}
                              onChange={(e) => setStateDirectives(parseInt(e.target.value))}
                              className="w-full h-1 bg-red-900/20 rounded-full appearance-none cursor-pointer accent-red-500"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Toggles */}
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { id: 'titles', label: t('lobby.creator.use_titles'), active: useTitleRoles, set: setUseTitleRoles },
                          { id: 'agendas', label: t('lobby.creator.use_agendas'), active: usePersonalAgendas, set: setUsePersonalAgendas },
                          { id: 'crisis', label: t('lobby.creator.use_crisis'), active: useCrisisCards, set: setUseCrisisCards },
                        ].map((rule) => (
                          <button
                            key={rule.id}
                            type="button"
                            onClick={() => { playSound('click'); rule.set(!rule.active); }}
                            className={cn(
                              "py-2 px-1 rounded-xl border text-[8px] font-mono uppercase tracking-tighter transition-all flex flex-col items-center justify-center gap-1",
                              rule.active 
                                ? "bg-red-400/10 border-red-500/30 text-red-400" 
                                : "bg-elevated border-subtle text-ghost"
                            )}
                          >
                            <div className={cn("w-2 h-2 rounded-full", rule.active ? "bg-red-400 shadow-[0_0_5px_rgba(248,113,113,0.5)]" : "bg-ghost/30")} />
                            {rule.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>


              {/* Privacy */}
              <div className="space-y-2">
                <label className="text-responsive-xs uppercase tracking-widest text-ghost font-mono ml-1">
                  {t('lobby.creator.privacy')}
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {privacyOptions.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onMouseEnter={() => playSound('hover')}
                      onClick={() => { playSound('click'); setPrivacy(opt.value); }}
                      className={cn(
                        'flex flex-col items-center gap-1 py-2 px-1 rounded-xl border text-center transition-all',
                        privacy === opt.value
                          ? 'border-red-500/50 bg-red-900/10 text-red-400'
                          : 'border-subtle bg-elevated text-ghost hover:border-default hover:text-muted'
                      )}
                    >
                      {opt.icon}
                      <span className="text-[9px] font-mono uppercase tracking-widest leading-none">
                        {opt.label}
                      </span>
                      <span className="text-[8px] text-faint leading-none">{opt.desc}</span>
                    </button>
                  ))}
                </div>
                {privacy === 'private' && (
                  <p className="text-[9px] text-faint font-mono ml-1 italic">
                    {t('lobby.creator.invite_code_hint')}
                  </p>
                )}
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => { playSound('click'); onClose(); }}
                  className="flex-1 py-[1.2vh] border border-subtle text-responsive-xs text-muted font-serif italic rounded-xl hover:bg-card transition-colors"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={maintenanceMode && !user.isAdmin}
                  className={cn(
                    "flex-1 py-[1.2vh] text-responsive-xs font-serif italic rounded-xl transition-colors",
                    maintenanceMode && !user.isAdmin
                      ? "bg-card text-ghost border border-subtle cursor-not-allowed"
                      : "btn-primary hover:bg-subtle"
                  )}
                >
                  {maintenanceMode && !user.isAdmin ? t('lobby.creator.btn_maintenance') : t('lobby.creator.btn_create')}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
