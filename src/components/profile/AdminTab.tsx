import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from '../../contexts/I18nContext';
import {
  Trash2,
  Users,
  Shield,
  RefreshCw,
  Search,
  Settings,
  MessageSquare,
  ChevronRight,
} from 'lucide-react';
import { socket } from '../../socket';
import { cn, apiUrl, debugError } from '../../utils/utils';
import { motion, AnimatePresence } from 'motion/react';
import { RoomInfo, User, SystemConfig } from '../../../shared/types';
import { AdminBroadcast } from './admin/AdminBroadcast';
import { AdminConfigPanel } from './admin/AdminConfigPanel';
import { AdminUserSearch } from './admin/AdminUserSearch';
import { AdminUserEditor } from './admin/AdminUserEditor';

type AdminTab = 'rooms' | 'users' | 'system' | 'logs';

const TAB_CONFIG: {
  id: AdminTab;
  label: string;
  icon: any;
  activeBg: string;
  activeColor: string;
}[] = [
  { id: 'rooms', label: 'profile.admin.tabs.rooms', icon: Shield, activeBg: 'bg-zinc-700 border-zinc-500', activeColor: 'text-white' },
  { id: 'users', label: 'profile.admin.tabs.users', icon: Users, activeBg: 'bg-yellow-900/40 border-yellow-600/60', activeColor: 'text-yellow-400' },
  { id: 'system', label: 'profile.admin.tabs.system', icon: Settings, activeBg: 'bg-blue-900/40 border-blue-600/60', activeColor: 'text-blue-400' },
  { id: 'logs', label: 'profile.admin.tabs.logs', icon: MessageSquare, activeBg: 'bg-emerald-900/40 border-emerald-600/60', activeColor: 'text-emerald-400' },
];

export const AdminTools: React.FC<{ adminId: string; token: string }> = ({ adminId, token }) => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<AdminTab>('rooms');
  const [rooms, setRooms] = useState<RoomInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [userSearchResults, setUserSearchResults] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [config, setConfig] = useState<SystemConfig>({ maintenanceMode: false, xpMultiplier: 1.0, ipMultiplier: 1.0 });
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [chatLogs, setChatLogs] = useState<{ sender: string; text: string; timestamp: number }[]>([]);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const fetchRooms = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(apiUrl('/api/rooms'));
      if (res.ok) {
        const data = await res.json();
        setRooms(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      debugError('Failed to fetch rooms:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchConfig = useCallback(async () => {
    try {
      const res = await fetch(apiUrl(`/api/admin/config?adminId=${adminId}`), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setConfig(data);
      }
    } catch (err) {
      debugError('Failed to fetch config:', err);
    }
  }, [adminId, token]);

  useEffect(() => {
    if (activeTab === 'rooms') fetchRooms();
    if (activeTab === 'system') fetchConfig();
  }, [activeTab, fetchRooms, fetchConfig]);

  useEffect(() => {
    const onChatLogs = (data: { roomId: string; logs: any[] }) => {
      if (data.roomId === selectedRoomId) setChatLogs(data.logs);
    };
    const onConfigUpdate = (newConfig: SystemConfig) => setConfig(newConfig);
    const onClearRedisSuccess = (msg: string) => alert(msg);

    socket.on('adminChatLogs', onChatLogs);
    socket.on('adminConfigUpdate', onConfigUpdate);
    socket.on('adminClearRedisSuccess', onClearRedisSuccess);

    return () => {
      socket.off('adminChatLogs', onChatLogs);
      socket.off('adminConfigUpdate', onConfigUpdate);
      socket.off('adminClearRedisSuccess', onClearRedisSuccess);
    };
  }, [selectedRoomId]);

  const handleDeleteRoom = (roomId: string) => {
    socket.emit('adminDeleteRoom', roomId);
    setConfirmDelete(null);
    setRooms(p => p.filter(r => r.id !== roomId));
  };

  const handleUpdateUser = (userId: string, updates: any) => {
    setUserSearchResults(prev => prev.map(u => u.id === userId ? { ...u, ...updates } : u));
    if (selectedUser?.id === userId) setSelectedUser(prev => prev ? { ...prev, ...updates } : null);
  };

  return (
    <div className="flex flex-col h-full max-h-[85vh] overflow-hidden bg-elevated/30 rounded-3xl border border-subtle shadow-2xl">
      <div className="flex bg-elevated/80 border-b border-subtle p-2 gap-1.5 sticky top-0 z-30 shadow-sm">
        {TAB_CONFIG.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl transition-all border font-mono uppercase tracking-[0.15em] text-[10px]',
              activeTab === tab.id ? cn(tab.activeBg, tab.activeColor, 'shadow-md') : 'bg-transparent border-transparent text-muted hover:text-ghost hover:bg-elevated/50'
            )}
          >
            <tab.icon className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{t(tab.label)}</span>
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-8 scrollbar-hide">
        <AnimatePresence mode="wait">
          {activeTab === 'rooms' && (
            <motion.div key="rooms" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-6">
              <AdminBroadcast />
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 px-2">
                <div className="flex items-center gap-2 flex-1">
                  <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ghost" />
                    <input type="text" placeholder={t('profile.admin.rooms.filter_placeholder')} className="w-full bg-white border border-subtle rounded-xl py-2.5 pl-9 pr-4 text-sm text-black placeholder:text-zinc-400 font-mono focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all" />
                  </div>
                  <button onClick={fetchRooms} className={cn('p-2.5 rounded-xl border border-subtle bg-white text-ghost hover:text-primary transition-all shadow-sm group', loading && 'animate-spin')} title={t('profile.admin.rooms.btn_refresh')}>
                    <RefreshCw className="w-4 h-4 group-hover:rotate-180 transition-transform duration-500" />
                  </button>
                  <button onClick={() => confirm(t('profile.admin.rooms.purge_confirm')) && socket.emit('adminClearRedis')} className="p-2.5 rounded-xl border border-red-500/20 bg-red-500/5 text-red-400 hover:bg-red-500/10 hover:border-red-500/40 transition-all shadow-sm" title={t('profile.admin.rooms.btn_purge')}>
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <span className="text-[10px] font-mono text-faint uppercase font-bold tracking-widest bg-elevated/50 px-3 py-1.5 rounded-lg border border-subtle/30">{t('profile.admin.rooms.active_sessions', { count: rooms.length })}</span>
              </div>
              <div className="grid grid-cols-1 gap-3">
                {rooms.map(room => (
                  <div key={room.id} className="bg-card/40 border border-subtle rounded-2xl p-4 flex items-center justify-between group hover:border-ghost/30 transition-all">
                    <div className="flex items-center gap-4">
                      <div className="px-2.5 py-1 rounded bg-elevated border border-subtle font-mono text-[10px] font-bold text-primary tracking-wider">{room.id}</div>
                      <div className="flex flex-col"><span className="text-[10px] font-mono text-faint uppercase mb-0.5">{t('profile.admin.rooms.host_label', { name: room.hostName })}</span><div className="flex items-center gap-2"><span className={cn('text-[10px] uppercase font-bold tracking-widest', room.phase === 'Lobby' ? 'text-emerald-400' : 'text-blue-400')}>{room.phase}</span><span className="text-[10px] text-ghost opacity-30">•</span><span className="text-[10px] text-ghost font-mono">{t('profile.admin.rooms.users_summary', { current: room.playerCount, max: room.maxPlayers })}</span></div></div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => { setSelectedRoomId(room.id); setChatLogs([]); socket.emit('adminGetChatLogs', room.id); }} className="p-2.5 rounded-xl hover:bg-primary/10 text-ghost hover:text-primary transition-all"><MessageSquare className="w-4 h-4" /></button>
                      {confirmDelete === room.id ? (
                        <div className="flex gap-2">
                          <button onClick={() => handleDeleteRoom(room.id)} className="px-3 py-1.5 bg-red-600 text-white text-[10px] rounded-lg uppercase font-bold shadow-lg shadow-red-900/40">{t('common.confirm')}</button>
                          <button onClick={() => setConfirmDelete(null)} className="px-3 py-1.5 bg-elevated text-ghost text-[10px] rounded-lg border border-subtle uppercase">{t('common.cancel')}</button>
                        </div>
                      ) : (
                        <button onClick={() => setConfirmDelete(room.id)} className="p-2.5 text-red-500/50 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all"><Trash2 className="w-4 h-4" /></button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {activeTab === 'users' && (
            <motion.div key="users" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                <AdminUserSearch adminId={adminId} token={token} searchQuery={userSearchQuery} setSearchQuery={setUserSearchQuery} results={userSearchResults} setResults={setUserSearchResults} selectedUser={selectedUser} setSelectedUser={setSelectedUser} loading={loading} setLoading={setLoading} hasSearched={hasSearched} setHasSearched={setHasSearched} />
                <AnimatePresence mode="wait">{selectedUser && <AdminUserEditor user={selectedUser} onClose={() => setSelectedUser(null)} onUpdate={handleUpdateUser} />}</AnimatePresence>
              </div>
            </motion.div>
          )}

          {activeTab === 'system' && <AdminConfigPanel config={config} setConfig={setConfig} token={token} />}

          {activeTab === 'logs' && (
            <motion.div key="logs" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="grid grid-cols-1 md:grid-cols-3 gap-6 h-[65vh]">
              <div className="bg-card/40 border border-subtle rounded-3xl flex flex-col overflow-hidden shadow-xl">
                <div className="p-4 border-b border-subtle bg-elevated/30 flex items-center justify-between"><span className="text-[10px] font-mono text-faint uppercase font-bold tracking-widest">{t('profile.admin.logs.sessions')}</span><button onClick={fetchRooms} className={cn('text-ghost hover:text-primary transition-colors', loading && 'animate-spin')}><RefreshCw className="w-3 h-3" /></button></div>
                <div className="flex-1 overflow-y-auto p-2 space-y-1 scrollbar-hide">
                  {rooms.map(room => (
                    <button key={room.id} onClick={() => { setSelectedRoomId(room.id); setChatLogs([]); socket.emit('adminGetChatLogs', room.id); }} className={cn('w-full text-left p-3.5 rounded-xl transition-all border flex items-center justify-between group', selectedRoomId === room.id ? 'bg-emerald-900/20 border-emerald-500/40 text-emerald-400 shadow-inner' : 'border-transparent text-ghost hover:bg-elevated hover:text-primary')}>
                      <div className="flex flex-col"><span className="text-xs font-bold truncate max-w-[140px]">{room.id}</span><span className="text-[10px] font-mono opacity-50 uppercase tracking-tighter">{room.phase}</span></div>
                      <ChevronRight className={cn('w-3.5 h-3.5 transition-transform', selectedRoomId === room.id ? 'translate-x-1' : 'opacity-20 group-hover:opacity-60')} />
                    </button>
                  ))}
                </div>
              </div>
              <div className="md:col-span-2 bg-black/60 border border-subtle rounded-3xl flex flex-col overflow-hidden shadow-2xl">
                <div className="p-4 border-b border-subtle bg-elevated/30 flex items-center justify-between">
                  <div className="flex items-center gap-3"><MessageSquare className="w-4 h-4 text-emerald-500" /><span className="text-[10px] font-mono text-ghost uppercase font-bold tracking-widest">{selectedRoomId ? t('profile.admin.logs.persisted_log', { id: selectedRoomId }) : t('profile.admin.logs.waiting')}</span></div>
                  {selectedRoomId && <button onClick={() => socket.emit('adminGetChatLogs', selectedRoomId)} className="text-ghost hover:text-emerald-400 transition-colors"><RefreshCw className="w-3.5 h-3.5" /></button>}
                </div>
                <div className="flex-1 overflow-y-auto p-5 space-y-2.5 font-mono text-[11px] scrollbar-hide">
                  {chatLogs.map((log, idx) => (
                    <div key={idx} className="flex gap-3 text-secondary/70 animate-in fade-in slide-in-from-left-2 duration-300">
                      <span className="text-muted w-10 shrink-0 text-[10px]">{new Date(log.timestamp).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit' })}</span>
                      <span className="text-primary font-bold w-24 shrink-0 truncate">[{log.sender}]</span>
                      <span className="text-ghost break-words">{log.text}</span>
                    </div>
                  ))}
                  {selectedRoomId && chatLogs.length === 0 && <div className="text-center py-12 opacity-20 italic">{t('profile.admin.logs.empty')}</div>}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};


