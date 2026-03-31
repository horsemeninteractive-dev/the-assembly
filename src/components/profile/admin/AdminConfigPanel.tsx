import React from 'react';
import { motion } from 'motion/react';
import { Server, Activity, Clock } from 'lucide-react';
import { SystemConfig } from '../../../types';
import { cn } from '../../../lib/utils';
import { socket } from '../../../socket';

interface AdminConfigPanelProps {
  config: SystemConfig;
  setConfig: React.Dispatch<React.SetStateAction<SystemConfig>>;
}

export const AdminConfigPanel: React.FC<AdminConfigPanelProps> = ({ config, setConfig }) => {
  const handleUpdateConfig = (updates: Partial<SystemConfig>) => {
    const newConfig = { ...config, ...updates };
    setConfig(newConfig);
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
              Live Controller
            </h2>
            <p className="text-[10px] text-blue-400 font-mono uppercase tracking-widest">
              Environment Meta-Data
            </p>
          </div>
        </div>

        <div className="space-y-6">
          <div
            className={cn(
              'flex items-center justify-between p-7 rounded-3xl border transition-all shadow-inner',
              config.maintenanceMode
                ? 'bg-red-900/20 border-red-500/40'
                : 'bg-elevated/30 border-subtle'
            )}
          >
            <div className="flex gap-4">
              <div
                className={cn(
                  'w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg',
                  config.maintenanceMode ? 'bg-red-600 text-white' : 'bg-card text-ghost'
                )}
              >
                <Activity className="w-6 h-6" />
              </div>
              <div>
                <div className="text-sm font-bold text-primary uppercase tracking-widest">
                  Maintenance Mode
                </div>
                <div className="text-[10px] font-mono uppercase mt-0.5 opacity-60">
                  {config.maintenanceMode
                    ? 'Blocking non-admin sessions'
                    : 'Sessions open to all'}
                </div>
              </div>
            </div>
            <button
              onClick={() =>
                handleUpdateConfig({ maintenanceMode: !config.maintenanceMode })
              }
              className={cn(
                'relative w-16 h-8 rounded-full transition-all duration-300 shadow-lg',
                config.maintenanceMode ? 'bg-red-600' : 'bg-zinc-700 border border-zinc-600'
              )}
            >
              <div
                className={cn(
                  'absolute top-1 w-6 h-6 rounded-full bg-white transition-all transform shadow-md',
                  config.maintenanceMode ? 'left-9' : 'left-1'
                )}
              />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-elevated/50 p-6 rounded-3xl border border-subtle space-y-4">
              <div className="flex justify-between items-center">
                <div className="text-[10px] font-mono text-blue-400 uppercase font-bold tracking-widest">
                  XP MULTIPLIER
                </div>
                <span className="text-2xl font-thematic text-primary">
                  {config.xpMultiplier}x
                </span>
              </div>
              <input
                type="range"
                min="1"
                max="5"
                step="0.5"
                value={config.xpMultiplier}
                onChange={(e) =>
                  handleUpdateConfig({ xpMultiplier: parseFloat(e.target.value) })
                }
                className="w-full accent-blue-500 h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer"
              />
            </div>
            <div className="bg-elevated/50 p-6 rounded-3xl border border-subtle space-y-4">
              <div className="flex justify-between items-center">
                <div className="text-[10px] font-mono text-emerald-400 uppercase font-bold tracking-widest">
                  IP MULTIPLIER
                </div>
                <span className="text-2xl font-thematic text-primary">
                  {config.ipMultiplier}x
                </span>
              </div>
              <input
                type="range"
                min="1"
                max="5"
                step="0.5"
                value={config.ipMultiplier}
                onChange={(e) =>
                  handleUpdateConfig({ ipMultiplier: parseFloat(e.target.value) })
                }
                className="w-full accent-emerald-500 h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer"
              />
            </div>
          </div>

          <div className="pt-6 border-t border-subtle/50 flex justify-end">
            <p className="text-[9px] text-faint font-mono flex items-center gap-2 uppercase tracking-tighter italic">
              <Clock className="w-3 h-3" />
              Configuration propagates through Redis Pub/Sub in real-time
            </p>
          </div>
        </div>
      </section>
    </motion.div>
  );
};
