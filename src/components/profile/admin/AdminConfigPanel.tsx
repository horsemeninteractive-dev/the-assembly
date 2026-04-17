import React, { useState, useEffect } from 'react';
import { useTranslation } from '../../../contexts/I18nContext';
import { motion } from 'motion/react';
import { Server, Activity, Clock, Zap } from 'lucide-react';
import { SystemConfig } from '../../../../shared/types';
import { cn, apiUrl } from '../../../utils/utils';
import { socket } from '../../../socket';

interface AdminConfigPanelProps {
  config: SystemConfig;
  setConfig: React.Dispatch<React.SetStateAction<SystemConfig>>;
  token: string;
}

export const AdminConfigPanel: React.FC<AdminConfigPanelProps> = ({ config, setConfig, token }) => {
  const { t } = useTranslation();

  // Local draft state — updates UI instantly without hitting the DB on every slider tick
  const [draft, setDraft] = useState<SystemConfig>(config);

  // Keep draft in sync if parent config changes externally (e.g. socket event on another screen)
  useEffect(() => { setDraft(config); }, [config]);

  // Called only when slider is released — persists to DB via socket
  const commitConfig = (updates: Partial<SystemConfig>) => {
    const newConfig = { ...config, ...updates };
    setConfig(newConfig);
    setDraft(newConfig);
    socket.emit('adminUpdateConfig', updates);
  };

  return (
    <motion.div
      key="system"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="max-w-2xl mx-auto space-y-6"
    >
      <section className="bg-card/50 border border-subtle rounded-3xl p-8 space-y-8 shadow-xl">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-blue-500/20 flex items-center justify-center border border-blue-500/30">
            <Server className="w-6 h-6 text-blue-400" />
          </div>
          <div>
            <h2 className="text-xl font-thematic uppercase tracking-[0.15em] text-primary">
              {t('profile.admin.tabs.system')}
            </h2>
            <p className="text-[10px] text-blue-400 font-mono uppercase tracking-widest">
              Environment Meta-Data
            </p>
          </div>
        </div>

        <div className="space-y-6">
          {/* Maintenance Mode Toggle */}
          <div
            className={cn(
              'flex items-center justify-between p-7 rounded-3xl border transition-all shadow-inner',
              draft.maintenanceMode
                ? 'bg-red-900/20 border-red-500/40'
                : 'bg-elevated/30 border-subtle'
            )}
          >
            <div className="flex gap-4">
              <div
                className={cn(
                  'w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg',
                  draft.maintenanceMode ? 'bg-red-600 text-white' : 'bg-card text-ghost'
                )}
              >
                <Activity className="w-6 h-6" />
              </div>
              <div>
                <div className="text-sm font-bold text-primary uppercase tracking-widest">
                  {t('profile.admin.config.maintenance')}
                </div>
                <div className="text-[10px] font-mono uppercase mt-0.5 opacity-60">
                  {draft.maintenanceMode
                    ? 'Blocking non-admin sessions'
                    : 'Sessions open to all'}
                </div>
              </div>
            </div>
            <button
              onClick={() => commitConfig({ maintenanceMode: !draft.maintenanceMode })}
              className={cn(
                'relative w-16 h-8 rounded-full transition-all duration-300 shadow-lg',
                draft.maintenanceMode ? 'bg-red-600' : 'bg-zinc-700 border border-zinc-600'
              )}
            >
              <div
                className={cn(
                  'absolute top-1 w-6 h-6 rounded-full bg-white transition-all transform shadow-md',
                  draft.maintenanceMode ? 'left-9' : 'left-1'
                )}
              />
            </button>
          </div>

          {/* XP / IP Multiplier Sliders */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-elevated/50 p-6 rounded-3xl border border-subtle space-y-4">
              <div className="flex justify-between items-center">
                <div className="text-[10px] font-mono text-blue-400 uppercase font-bold tracking-widest">
                  {t('profile.admin.config.xp_boost')}
                </div>
                <span className="text-2xl font-thematic text-primary">
                  {draft.xpMultiplier}x
                </span>
              </div>
              <input
                type="range"
                min="1"
                max="5"
                step="0.5"
                value={draft.xpMultiplier}
                onChange={(e) => setDraft(d => ({ ...d, xpMultiplier: parseFloat(e.target.value) }))}
                onMouseUp={(e) => commitConfig({ xpMultiplier: parseFloat((e.target as HTMLInputElement).value) })}
                onTouchEnd={(e) => commitConfig({ xpMultiplier: parseFloat((e.target as HTMLInputElement).value) })}
                className="w-full accent-blue-500 h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer"
              />
            </div>
            <div className="bg-elevated/50 p-6 rounded-3xl border border-subtle space-y-4">
              <div className="flex justify-between items-center">
                <div className="text-[10px] font-mono text-emerald-400 uppercase font-bold tracking-widest">
                  {t('profile.admin.config.ip_boost')}
                </div>
                <span className="text-2xl font-thematic text-primary">
                  {draft.ipMultiplier}x
                </span>
              </div>
              <input
                type="range"
                min="1"
                max="5"
                step="0.5"
                value={draft.ipMultiplier}
                onChange={(e) => setDraft(d => ({ ...d, ipMultiplier: parseFloat(e.target.value) }))}
                onMouseUp={(e) => commitConfig({ ipMultiplier: parseFloat((e.target as HTMLInputElement).value) })}
                onTouchEnd={(e) => commitConfig({ ipMultiplier: parseFloat((e.target as HTMLInputElement).value) })}
                className="w-full accent-emerald-500 h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer"
              />
            </div>
          </div>

          <div className="pt-6 border-t border-subtle/50 flex flex-col sm:flex-row items-center justify-between gap-4">
            <button
              onClick={async () => {
                try {
                  const res = await fetch(apiUrl('/api/admin/test-push'), {
                    method: 'POST',
                    headers: {
                      Authorization: `Bearer ${token}`,
                      'Content-Type': 'application/json',
                    },
                  });
                  const data = await res.json();
                  if (res.ok) {
                    alert('Success: ' + data.message);
                  } else {
                    alert('Failed: ' + (data.error || 'Unknown error'));
                  }
                } catch (err: any) {
                  alert('Error: ' + err.message);
                }
              }}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-orange-600/20 border border-orange-500/30 text-orange-400 hover:bg-orange-600/30 transition-all font-mono text-[10px] uppercase tracking-widest shadow-lg active:scale-95"
            >
              <Activity className="w-3.5 h-3.5" />
              Send Test Web-Push
            </button>

            <button
              onClick={async () => {
                const season = prompt('Enter Season Name (e.g. "Season 1"):');
                if (!season) return;
                const secret = prompt('Enter Admin Secret:');
                if (!secret) return;

                if (!confirm(`Are you SURE you want to end ${season}? This will reset all ranked stats and grant rewards!`)) return;

                try {
                  const res = await fetch(apiUrl('/api/season/rollover'), {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ seasonPeriod: season, secret }),
                  });
                  const data = await res.json();
                  if (res.ok) {
                    alert('Rollover successful! Processed ' + data.processedCount + ' players.');
                  } else {
                    alert('Rollover failed: ' + (data.error || 'Unknown error'));
                  }
                } catch (err: any) {
                  alert('Error: ' + err.message);
                }
              }}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-red-600/20 border border-red-500/30 text-red-400 hover:bg-red-600/30 transition-all font-mono text-[10px] uppercase tracking-widest shadow-lg active:scale-95"
            >
              <Zap className="w-3.5 h-3.5 fill-red-400/20" />
              End Season (Rollover)
            </button>
            <p className="text-[9px] text-faint font-mono flex items-center gap-2 uppercase tracking-tighter italic">
              <Clock className="w-3 h-3" />
              Configuration saved to database on slider release
            </p>
          </div>
        </div>
      </section>
    </motion.div>
  );
};
