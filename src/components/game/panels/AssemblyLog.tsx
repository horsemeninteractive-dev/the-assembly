import React, { useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Scroll, X } from 'lucide-react';
import { cn } from '../../../utils/utils';
import { useTranslation } from '../../../contexts/I18nContext';

interface AssemblyLogProps {
  log: string[];
  isOpen: boolean;
  onClose: () => void;
  showDebug: boolean;
}

const getLogColor = (entry: string) => {
  if (entry.includes('DEBUG:')) return 'text-purple-400 border-purple-500';
  if (entry.includes('Civil') || entry.includes('Charter') || entry.includes('passed'))
    return 'text-blue-400 border-blue-900/30';
  if (
    entry.includes('State') ||
    entry.includes('Overseer') ||
    entry.includes('Supremacy') ||
    entry.includes('failed')
  )
    return 'text-red-500 border-red-900/30';
  if (entry.includes('executed') || entry.includes('killed') || entry.includes('Eliminated'))
    return 'text-red-600 font-bold border-red-900/50';
  if (entry.includes('elected') || entry.includes('nominated'))
    return 'text-yellow-500 border-yellow-900/30';
  if (entry.includes('veto') || entry.includes('Veto'))
    return 'text-purple-400 border-purple-900/30';
  return 'text-secondary border-default';
};

export const AssemblyLog = ({ log, isOpen, onClose, showDebug }: AssemblyLogProps) => {
  const { t } = useTranslation();
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(
        () => logEndRef.current?.scrollIntoView({ behavior: 'smooth' }),
        100
      );
      return () => clearTimeout(timer);
    }
  }, [isOpen, log]);

  const translateLogEntry = (raw: string) => {
    if (!raw) return '';
    
    // Round markers
    if (raw.startsWith('--- Round')) {
      const match = raw.match(/Round (\d+)/);
      if (match) return t('game.assembly_log.round_marker', { round: match[1] });
    }

    // Policy Enacted
    if (raw === 'Civil directive passed.' || raw === 'A Civil directive was enacted.') 
      return t('game.assembly_log.civil_enacted');
    if (raw === 'State directive passed.' || raw === 'A State directive was enacted.') 
      return t('game.assembly_log.state_enacted');

    // Vetoes
    if (raw.includes('requested a Veto')) {
      const name = raw.split(' (Chancellor)')[0];
      return t('game.assembly_log.veto_requested', { name: name.replace(' (AI)', '') });
    }
    if (raw.includes('agreed to the Veto')) {
      const name = raw.split(' (President)')[0];
      return t('game.assembly_log.veto_agreed', { name: name.replace(' (AI)', '') });
    }
    if (raw.includes('denied the Veto')) {
      const name = raw.split(' (President)')[0];
      return t('game.assembly_log.veto_denied', { name: name.replace(' (AI)', '') });
    }

    // Nomination/Election
    if (raw.includes(' nominated ')) {
      const parts = raw.split(' nominated ');
      const targetParts = parts[1]?.split(' as Chancellor');
      if (parts[0] && targetParts?.[0]) {
        return t('game.assembly_log.nominated', {
          name: parts[0].replace(' (AI)', ''),
          target: targetParts[0].replace(' (AI)', '')
        });
      }
    }
    if (raw.includes(' elected as Chancellor')) {
      const name = raw.split(' elected as Chancellor')[0];
      return t('game.assembly_log.elected', { name: name.replace(' (AI)', '') });
    }
    if (raw === 'The Assembly rejected the nomination.') return t('game.assembly_log.rejected');

    // Declarations
    if (raw.includes(' declared ')) {
      const parts = raw.split(' declared ');
      const typeMatch = parts[0]?.match(/\((President|Chancellor)\)/);
      const name = parts[0]?.split(' (')[0];
      const action = raw.includes(' passed ') ? t('game.assembly_log.passed_word') : t('game.assembly_log.received_word');
      const civMatch = raw.match(/(\d+) Civil/);
      const staMatch = raw.match(/(\d+) State/);
      const drewMatch = raw.match(/\(drew (\d+)C\/(\d+)S\)/);
      
      if (name && typeMatch) {
        const drewStr = drewMatch 
          ? t('game.assembly_log.drew_info', { civ: drewMatch[1], sta: drewMatch[2] })
          : '';
        return t('game.assembly_log.declared', {
          name: name.replace(' (AI)', ''),
          type: typeMatch[1],
          action,
          civ: civMatch?.[1] || '0',
          sta: staMatch?.[1] || '0',
          drew: drewStr
        });
      }
    }

    // Role actions
    if (raw.includes(' investigated ')) {
      const parts = raw.split(' investigated ');
      return t('game.assembly_log.investigated', { 
        name: parts[0].replace(' (AI)', ''), 
        target: parts[1].replace(' (AI)', '').replace('.', '') 
      });
    }
    if (raw.includes(' was executed.')) {
      const name = raw.split(' was executed.')[0];
      return t('game.assembly_log.executed', { name: name.replace(' (AI)', '') });
    }

    // Room / Join events
    if (raw.includes(' created in ') && raw.includes(' mode.')) {
      const parts = raw.split(' created in ');
      const roomId = parts[0].replace('Room ', '');
      const mode = parts[1].replace(' mode.', '');
      return t('game.assembly_log.room_created', { id: roomId, mode });
    }
    if (raw.includes(' created as a Solo Practice session.')) {
      const roomId = raw.split(' ')[1];
      return t('game.assembly_log.room_created_practice', { id: roomId });
    }
    if (raw.includes(' reconnected.')) {
      return t('game.assembly_log.reconnected', { name: raw.split(' reconnected.')[0].replace(' (AI)', '') });
    }
    if (raw.includes(' rejoined the lobby.')) {
      return t('game.assembly_log.rejoined', { name: raw.split(' rejoined the lobby.')[0].replace(' (AI)', '') });
    }
    if (raw.includes(' joined the lobby.')) {
      return t('game.assembly_log.joined', { name: raw.split(' joined the lobby.')[0].replace(' (AI)', '') });
    }
    if (raw === 'Need at least 5 players to ready up.') {
      return t('game.assembly_log.need_players');
    }
    if (raw === 'All human players ready! Starting game...') {
      return t('game.assembly_log.all_ready');
    }
    if (raw === 'Host started the game.') {
      return t('game.assembly_log.host_started');
    }
    if (raw === 'Room locked by host.') {
      return t('game.assembly_log.room_locked');
    }
    if (raw === 'Room unlocked by host.') {
      return t('game.assembly_log.room_unlocked');
    }

    // Predictions
    if (raw.includes('A spectator has predicted a ') && raw.includes(' victory.')) {
      const prediction = raw.includes('Unity') ? t('game.assembly_log.prediction_unity') : t('game.assembly_log.prediction_deception');
      return t('game.assembly_log.spectator_predicted', { prediction });
    }

    return raw.replace(/ \(AI\)/g, '');
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          className="fixed inset-0 z-[150] bg-surface flex flex-col"
        >
          <div className="h-14 px-4 flex items-center justify-between border-b border-subtle shrink-0 bg-surface">
            <div className="flex items-center gap-3">
              <Scroll className="w-4 h-4 text-primary" />
              <h3 className="font-thematic text-lg uppercase tracking-wider text-primary">
                {t('game.assembly_log.title')}
              </h3>
            </div>
            <button
              onClick={onClose}
              aria-label="Close Assembly Log"
              className="p-2 text-muted hover:text-white transition-colors bg-card rounded-xl"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div 
            aria-live="polite" 
            aria-atomic="false"
            className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar overscroll-contain bg-elevated"
          >
            {log
              .filter((entry) => showDebug || !entry.includes('DEBUG:'))
              .map((entry, i) => {
                const colorClass = getLogColor(entry);
                const isEvent = entry.startsWith('---');

                return (
                  <div
                    key={i}
                    className={cn(
                      'flex items-start gap-2 py-1.5 px-3 rounded-lg border text-[11px] leading-relaxed transition-all duration-300',
                      isEvent
                        ? 'justify-center border-none bg-transparent py-3'
                        : colorClass
                    )}
                  >
                    {!isEvent && (
                      <span className="text-[9px] font-mono text-faint shrink-0 mt-0.5 opacity-50">
                        {t('game.assembly_log.event_num', { count: i + 1 })}
                      </span>
                    )}
                    <div className={cn(
                      'font-mono break-words',
                      isEvent ? 'text-ghost uppercase tracking-[0.2em] text-[10px]' : ''
                    )}>
                      {translateLogEntry(entry)}
                    </div>
                  </div>
                );
              })}
            <div ref={logEndRef} />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
