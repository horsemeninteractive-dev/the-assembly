import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Ban, UserCheck } from 'lucide-react';
import { User } from '../../../types';
import { cn } from '../../../lib/utils';
import { socket } from '../../../socket';

interface AdminUserEditorProps {
  user: User;
  onClose: () => void;
  onUpdate: (userId: string, updates: any) => void;
}

export const AdminUserEditor: React.FC<AdminUserEditorProps> = ({ user, onClose, onUpdate }) => {
  const handleToggleBan = () => {
    onUpdate(user.id, { isBanned: !user.isBanned });
    socket.emit('adminUpdateUser', { userId: user.id, updates: { isBanned: !user.isBanned } });
  };

  const handleStatChange = (field: string, value: number) => {
    const updates = field === 'cabinetPoints' ? { cabinetPoints: value } : { stats: { ...user.stats, [field]: value } };
    onUpdate(user.id, updates);
    socket.emit('adminUpdateUser', { userId: user.id, updates });
  };

  return (
    <motion.div
      key={user.id}
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-card/80 border border-subtle rounded-3xl p-6 space-y-6 lg:sticky lg:top-4 shadow-xl"
    >
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-mono text-yellow-500 uppercase font-bold tracking-[0.2em]">
          Account Inspector
        </span>
        <button
          onClick={onClose}
          className="p-1 hover:bg-elevated rounded-lg transition-colors"
        >
          <X className="w-4 h-4 text-ghost" />
        </button>
      </div>

      <div className="flex items-center gap-4 border-b border-subtle pb-6">
        <img
          src={user.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.username}`}
          className="w-16 h-16 rounded-2xl bg-elevated border-2 border-primary/20 shadow-lg"
          alt=""
        />
        <div className="flex-1 min-w-0">
          <div className="text-xl font-thematic text-primary uppercase tracking-wider truncate">
            {user.username}
          </div>
          <div className="text-[10px] font-mono text-muted-foreground break-all opacity-60">
            {user.id}
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div
          className={cn(
            'flex items-center justify-between p-5 rounded-2xl border transition-all',
            user.isBanned ? 'bg-red-950/20 border-red-500/30' : 'bg-emerald-950/20 border-emerald-500/30'
          )}
        >
          <div>
            <div className="text-xs font-bold text-primary flex items-center gap-2">
              {user.isBanned ? <Ban className="w-3.5 h-3.5 text-red-500" /> : <UserCheck className="w-3.5 h-3.5 text-emerald-500" />}
              STATUS: {user.isBanned ? 'RESTRICTED' : 'ACTIVE'}
            </div>
            <div className="text-[9px] text-ghost font-mono uppercase mt-0.5">Toggle account access</div>
          </div>
          <button
            onClick={handleToggleBan}
            className={cn(
              'px-5 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all shadow-lg',
              user.isBanned ? 'bg-emerald-600 text-black hover:bg-emerald-500' : 'bg-red-600 text-white hover:bg-red-500'
            )}
          >
            {user.isBanned ? 'Pardon' : 'Ban'}
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-elevated/40 p-4 rounded-2xl border border-subtle">
            <div className="text-[9px] font-mono text-faint uppercase mb-1.5 font-bold tracking-widest">
              Cabinet Points
            </div>
            <input
              type="number"
              value={user.cabinetPoints}
              onChange={(e) => handleStatChange('cabinetPoints', parseInt(e.target.value) || 0)}
              className="bg-white w-full border border-subtle rounded-xl px-3 py-2 text-xs font-mono text-black outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>
          <div className="bg-elevated/40 p-4 rounded-2xl border border-subtle">
            <div className="text-[9px] font-mono text-faint uppercase mb-1.5 font-bold tracking-widest">
              ELO Rating
            </div>
            <input
              type="number"
              value={user.stats?.elo || 1000}
              onChange={(e) => handleStatChange('elo', parseInt(e.target.value) || 0)}
              className="bg-white w-full border border-subtle rounded-xl px-3 py-2 text-xs font-mono text-black outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>
        </div>
      </div>
    </motion.div>
  );
};
