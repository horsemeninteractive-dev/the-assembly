import React, { useState, useEffect } from 'react';
import {
  Trash2,
  Megaphone,
  Users,
  Clock,
  Shield,
  AlertTriangle,
  RefreshCw,
  Search,
  Settings,
  MessageSquare,
  Ban,
  UserCheck,
  Save,
  Server,
  Activity,
  ChevronRight,
  X,
} from 'lucide-react';
import { socket } from '../../socket';
import { cn, apiUrl, debugLog, debugError } from '../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { RoomInfo, User, SystemConfig } from '../../types';

type AdminTab = 'rooms' | 'users' | 'system' | 'logs';

const TAB_CONFIG: {
  id: AdminTab;
  label: string;
  icon: any;
  activeBg: string;
  activeColor: string;
}[] = [
  {
    id: 'rooms',
    label: 'Rooms',
    icon: Shield,
    activeBg: 'bg-zinc-700 border-zinc-500',
    activeColor: 'text-white',
  },
  {
    id: 'users',
    label: 'Users',
    icon: Users,
    activeBg: 'bg-yellow-900/40 border-yellow-600/60',
    activeColor: 'text-yellow-400',
  },
  {
    id: 'system',
    label: 'System',
    icon: Settings,
    activeBg: 'bg-blue-900/40 border-blue-600/60',
    activeColor: 'text-blue-400',
  },
  {
    id: 'logs',
    label: 'Chat Logs',
    icon: MessageSquare,
    activeBg: 'bg-emerald-900/40 border-emerald-600/60',
    activeColor: 'text-emerald-400',
  },
];

interface AdminToolsProps {
  adminId: string;
  token: string;
}

export const AdminTools: React.FC<AdminToolsProps> = ({ adminId, token }) => {
  const [activeTab, setActiveTab] = useState<AdminTab>('rooms');
  const [rooms, setRooms] = useState<RoomInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [isBroadcasting, setIsBroadcasting] = useState(false);

  // User Management State
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [userSearchResults, setUserSearchResults] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  // System Config State
  const [config, setConfig] = useState<SystemConfig>({
    maintenanceMode: false,
    xpMultiplier: 1.0,
    ipMultiplier: 1.0,
  });

  // Chat Logs State
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [chatLogs, setChatLogs] = useState<{ sender: string; text: string; timestamp: number }[]>(
    []
  );

  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const fetchRooms = async () => {
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
  };

  const fetchConfig = async () => {
    if (!adminId) return;
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
  };

  useEffect(() => {
    if (activeTab === 'rooms') fetchRooms();
    if (activeTab === 'system') fetchConfig();
  }, [activeTab]);

  useEffect(() => {
    const onChatLogs = (data: { roomId: string; logs: any[] }) => {
      if (data.roomId === selectedRoomId) {
        setChatLogs(data.logs);
      }
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
    setRooms((prev) => prev.filter((r) => r.id !== roomId));
  };

  const handleBroadcast = () => {
    if (!broadcastMessage.trim()) return;
    setIsBroadcasting(true);
    socket.emit('adminBroadcast', broadcastMessage);
    setBroadcastMessage('');
    setTimeout(() => setIsBroadcasting(false), 2000);
  };

  const handleSearchUsers = async () => {
    if (!userSearchQuery.trim() || !adminId) return;
    setLoading(true);
    setHasSearched(true);
    try {
      debugLog(`[AdminTools] Searching for: "${userSearchQuery}" with adminId: ${adminId}`);
      const res = await fetch(
        apiUrl(`/api/admin/users/search?adminId=${adminId}&q=${userSearchQuery}`),
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (res.ok) {
        const data = await res.json();
        debugLog(`[AdminTools] Search results:`, data);
        setUserSearchResults(data);
        if (data.length > 0) setSelectedUser(data[0]);
      } else {
        const errText = await res.text();
        debugError(`[AdminTools] Search failed (${res.status}):`, errText);
      }
    } catch (err) {
      debugError('Failed to search users:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateUser = (userId: string, updates: any) => {
    socket.emit('adminUpdateUser', { userId, updates });
    setUserSearchResults((prev) => prev.map((u) => (u.id === userId ? { ...u, ...updates } : u)));
    if (selectedUser?.id === userId) {
      setSelectedUser((prev) => (prev ? { ...prev, ...updates } : null));
    }
  };

  const handleClearRedis = () => {
    if (
      !confirm(
        'Are you sure you want to purge ALL stale Redis room data? This will not affect active in-memory rooms but will prevent them from being restored on restart.'
      )
    )
      return;
    socket.emit('adminClearRedis');
  };

  const handleUpdateConfig = (updates: Partial<SystemConfig>) => {
    const newConfig = { ...config, ...updates };
    setConfig(newConfig);
    socket.emit('adminUpdateConfig', updates);
  };

  const handleGetChatLogs = (roomId: string) => {
    setSelectedRoomId(roomId);
    setChatLogs([]);
    socket.emit('adminGetChatLogs', roomId);
  };

  return (
    <div className="flex flex-col h-full max-h-[85vh] overflow-hidden bg-elevated/30 rounded-3xl border border-subtle shadow-2xl">
      {/* Sidebar Tabs - Styled like Leaderboard/Shop */}
      <div className="flex bg-elevated/80 border-b border-subtle p-2 gap-1.5 sticky top-0 z-30 shadow-sm">
        {TAB_CONFIG.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl transition-all border font-mono uppercase tracking-[0.15em] text-[10px]',
              activeTab === tab.id
                ? cn(tab.activeBg, tab.activeColor, 'shadow-md')
                : 'bg-transparent border-transparent text-muted hover:text-ghost hover:bg-elevated/50'
            )}
          >
            <tab.icon className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-8 scrollbar-hide">
        <AnimatePresence mode="wait">
          {activeTab === 'rooms' && (
            <motion.div
              key="rooms"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              <section className="bg-yellow-500/5 border border-yellow-500/20 rounded-3xl p-6 relative overflow-hidden">
                <div className="flex items-center gap-3 mb-4">
                  <Megaphone className="w-5 h-5 text-yellow-500" />
                  <h3 className="text-xs font-mono text-primary uppercase tracking-widest font-bold">
                    Global Broadcast
                  </h3>
                </div>
                <div className="flex gap-3">
                  <input
                    type="text"
                    value={broadcastMessage}
                    onChange={(e) => setBroadcastMessage(e.target.value)}
                    placeholder="Message all players..."
                    className="flex-1 bg-white border border-subtle rounded-2xl px-4 py-3 text-sm font-mono text-black placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-yellow-500/50"
                  />
                  <button
                    onClick={handleBroadcast}
                    disabled={isBroadcasting || !broadcastMessage.trim()}
                    className="btn-primary bg-yellow-600 border-yellow-500 text-black px-8 rounded-2xl font-thematic uppercase tracking-widest text-xs"
                  >
                    {isBroadcasting ? 'Sent!' : 'Broadcast'}
                  </button>
                </div>
              </section>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 px-2">
                <div className="flex items-center gap-2 flex-1">
                  <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ghost" />
                    <input
                      type="text"
                      placeholder="Filter active rooms..."
                      className="w-full bg-white border border-subtle rounded-xl py-2.5 pl-9 pr-4 text-sm text-black placeholder:text-zinc-400 font-mono focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                    />
                  </div>
                  <button
                    onClick={fetchRooms}
                    className={cn(
                      'p-2.5 rounded-xl border border-subtle bg-white text-ghost hover:text-primary transition-all shadow-sm group',
                      loading && 'animate-spin'
                    )}
                    title="Refresh Rooms"
                  >
                    <RefreshCw className="w-4 h-4 group-hover:rotate-180 transition-transform duration-500" />
                  </button>
                  <button
                    onClick={handleClearRedis}
                    className="p-2.5 rounded-xl border border-red-500/20 bg-red-500/5 text-red-400 hover:bg-red-500/10 hover:border-red-500/40 transition-all shadow-sm"
                    title="Purge Redis Stale Games"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <span className="text-[10px] font-mono text-faint uppercase font-bold tracking-widest bg-elevated/50 px-3 py-1.5 rounded-lg border border-subtle/30">
                  {rooms.length} Active Sessions
                </span>
              </div>

              <div className="grid grid-cols-1 gap-3">
                {rooms.map((room) => (
                  <div
                    key={room.id}
                    className="bg-card/40 border border-subtle rounded-2xl p-4 flex items-center justify-between group hover:border-ghost/30 transition-all"
                  >
                    <div className="flex items-center gap-4">
                      <div className="px-2.5 py-1 rounded bg-elevated border border-subtle font-mono text-[10px] font-bold text-primary tracking-wider">
                        {room.id}
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[10px] font-mono text-faint uppercase mb-0.5">
                          Host: {room.hostName}
                        </span>
                        <div className="flex items-center gap-2">
                          <span
                            className={cn(
                              'text-[10px] uppercase font-bold tracking-widest',
                              room.phase === 'Lobby' ? 'text-emerald-400' : 'text-blue-400'
                            )}
                          >
                            {room.phase}
                          </span>
                          <span className="text-[10px] text-ghost opacity-30">•</span>
                          <span className="text-[10px] text-ghost font-mono">
                            {room.playerCount}/{room.maxPlayers} USERS
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleGetChatLogs(room.id)}
                        className="p-2.5 rounded-xl hover:bg-primary/10 text-ghost hover:text-primary transition-all"
                        title="View Chat Logs"
                      >
                        <MessageSquare className="w-4 h-4" />
                      </button>
                      {confirmDelete === room.id ? (
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleDeleteRoom(room.id)}
                            className="px-3 py-1.5 bg-red-600 text-white text-[10px] rounded-lg uppercase font-bold shadow-lg shadow-red-900/40"
                          >
                            Confirm
                          </button>
                          <button
                            onClick={() => setConfirmDelete(null)}
                            className="px-3 py-1.5 bg-elevated text-ghost text-[10px] rounded-lg border border-subtle uppercase"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmDelete(room.id)}
                          className="p-2.5 text-red-500/50 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {activeTab === 'users' && (
            <motion.div
              key="users"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              <div className="flex gap-3 mb-8">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ghost" />
                  <input
                    type="text"
                    value={userSearchQuery}
                    onChange={(e) => setUserSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearchUsers()}
                    placeholder="Search users by username or ID..."
                    className="w-full bg-white border border-subtle rounded-xl py-3 pl-10 pr-4 text-sm font-mono text-black placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-yellow-500/50 shadow-sm transition-all"
                  />
                </div>
                <button
                  onClick={handleSearchUsers}
                  disabled={loading}
                  className="bg-yellow-600 hover:bg-yellow-500 disabled:opacity-50 text-black px-8 rounded-xl font-thematic uppercase tracking-widest text-xs transition-all shadow-md active:scale-95 disabled:active:scale-100"
                >
                  {loading ? 'Searching...' : 'Search'}
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                <div className="space-y-2.5">
                  <div className="text-[10px] font-mono text-faint uppercase font-bold tracking-[0.2em] mb-2 px-2">
                    Results
                  </div>
                  {userSearchResults.map((user) => (
                    <button
                      key={user.id}
                      onClick={() => setSelectedUser(user)}
                      className={cn(
                        'w-full bg-card/40 border rounded-2xl p-4 flex items-center justify-between text-left transition-all hover:border-primary/40',
                        selectedUser?.id === user.id
                          ? 'border-yellow-500/50 bg-yellow-500/5 ring-1 ring-yellow-500/30'
                          : 'border-subtle'
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <img
                          src={
                            user.avatarUrl ||
                            `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.username}`
                          }
                          className="w-10 h-10 rounded-xl bg-elevated border border-subtle"
                          alt=""
                        />
                        <div className="flex flex-col">
                          <span
                            className={cn(
                              'text-sm font-bold',
                              selectedUser?.id === user.id ? 'text-yellow-400' : 'text-primary'
                            )}
                          >
                            {user.username}
                          </span>
                          <span className="text-[10px] font-mono text-ghost flex items-center gap-1.5">
                            ID: {user.id.slice(0, 8)}
                            {user.isAdmin && <Shield className="w-2.5 h-2.5 text-yellow-500" />}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {user.isBanned && <Ban className="w-4 h-4 text-red-500" />}
                        <ChevronRight
                          className={cn(
                            'w-4 h-4 transition-transform',
                            selectedUser?.id === user.id
                              ? 'translate-x-0.5 text-yellow-500'
                              : 'text-ghost opacity-20'
                          )}
                        />
                      </div>
                    </button>
                  ))}
                  {userSearchResults.length === 0 && !loading && (
                    <div className="py-16 text-center bg-elevated/20 border border-dashed border-subtle rounded-3xl">
                      <Users className="w-8 h-8 text-ghost/20 mx-auto mb-3" />
                      <p className="text-ghost text-[10px] font-mono uppercase tracking-widest italic">
                        {hasSearched
                          ? 'No players found matching criteria'
                          : 'Enter criteria above'}
                      </p>
                    </div>
                  )}
                </div>

                <AnimatePresence mode="wait">
                  {selectedUser && (
                    <motion.div
                      key={selectedUser.id}
                      initial={{ opacity: 0, scale: 0.98 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="bg-card/80 border border-subtle rounded-3xl p-6 space-y-6 lg:sticky lg:top-4 shadow-xl"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-mono text-yellow-500 uppercase font-bold tracking-[0.2em]">
                          Account Inspector
                        </span>
                        <button
                          onClick={() => setSelectedUser(null)}
                          className="p-1 hover:bg-elevated rounded-lg transition-colors"
                        >
                          <X className="w-4 h-4 text-ghost" />
                        </button>
                      </div>

                      <div className="flex items-center gap-4 border-b border-subtle pb-6">
                        <img
                          src={
                            selectedUser.avatarUrl ||
                            `https://api.dicebear.com/7.x/avataaars/svg?seed=${selectedUser.username}`
                          }
                          className="w-16 h-16 rounded-2xl bg-elevated border-2 border-primary/20 shadow-lg"
                          alt=""
                        />
                        <div>
                          <div className="text-xl font-thematic text-primary uppercase tracking-wider">
                            {selectedUser.username}
                          </div>
                          <div className="text-[10px] font-mono text-muted-foreground break-all opacity-60">
                            {selectedUser.id}
                          </div>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div
                          className={cn(
                            'flex items-center justify-between p-5 rounded-2xl border transition-all',
                            selectedUser.isBanned
                              ? 'bg-red-950/20 border-red-500/30'
                              : 'bg-emerald-950/20 border-emerald-500/30'
                          )}
                        >
                          <div>
                            <div className="text-xs font-bold text-primary flex items-center gap-2">
                              {selectedUser.isBanned ? (
                                <Ban className="w-3.5 h-3.5 text-red-500" />
                              ) : (
                                <UserCheck className="w-3.5 h-3.5 text-emerald-500" />
                              )}
                              STATUS: {selectedUser.isBanned ? 'RESTRICTED' : 'ACTIVE'}
                            </div>
                            <div className="text-[9px] text-ghost font-mono uppercase mt-0.5">
                              Toggle account access
                            </div>
                          </div>
                          <button
                            onClick={() =>
                              handleUpdateUser(selectedUser.id, {
                                isBanned: !selectedUser.isBanned,
                              })
                            }
                            className={cn(
                              'px-5 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all shadow-lg',
                              selectedUser.isBanned
                                ? 'bg-emerald-600 text-black hover:bg-emerald-500'
                                : 'bg-red-600 text-white hover:bg-red-500'
                            )}
                          >
                            {selectedUser.isBanned ? 'Pardon' : 'Ban'}
                          </button>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div className="bg-elevated/40 p-4 rounded-2xl border border-subtle">
                            <div className="text-[9px] font-mono text-faint uppercase mb-1.5 font-bold tracking-widest">
                              Cabinet Points
                            </div>
                            <input
                              type="number"
                              value={selectedUser.cabinetPoints}
                              onChange={(e) =>
                                handleUpdateUser(selectedUser.id, {
                                  cabinetPoints: parseInt(e.target.value) || 0,
                                })
                              }
                              className="bg-white w-full border border-subtle rounded-xl px-3 py-2 text-xs font-mono text-black outline-none focus:ring-2 focus:ring-primary/40"
                            />
                          </div>
                          <div className="bg-elevated/40 p-4 rounded-2xl border border-subtle">
                            <div className="text-[9px] font-mono text-faint uppercase mb-1.5 font-bold tracking-widest">
                              ELO Rating
                            </div>
                            <input
                              type="number"
                              value={selectedUser.stats?.elo || 1000}
                              onChange={(e) =>
                                handleUpdateUser(selectedUser.id, {
                                  stats: { elo: parseInt(e.target.value) || 0 },
                                })
                              }
                              className="bg-white w-full border border-subtle rounded-xl px-3 py-2 text-xs font-mono text-black outline-none focus:ring-2 focus:ring-primary/40"
                            />
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          )}

          {activeTab === 'system' && (
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
          )}

          {activeTab === 'logs' && (
            <motion.div
              key="logs"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="grid grid-cols-1 md:grid-cols-3 gap-6 h-[65vh]"
            >
              <div className="bg-card/40 border border-subtle rounded-3xl flex flex-col overflow-hidden shadow-xl">
                <div className="p-4 border-b border-subtle bg-elevated/30 flex items-center justify-between">
                  <span className="text-[10px] font-mono text-faint uppercase font-bold tracking-widest">
                    Sessions
                  </span>
                  <button
                    onClick={fetchRooms}
                    className={cn(
                      'text-ghost hover:text-primary transition-colors',
                      loading && 'animate-spin'
                    )}
                  >
                    <RefreshCw className="w-3 h-3" />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-1 scrollbar-hide">
                  {rooms.map((room) => (
                    <button
                      key={room.id}
                      onClick={() => handleGetChatLogs(room.id)}
                      className={cn(
                        'w-full text-left p-3.5 rounded-xl transition-all border flex items-center justify-between group',
                        selectedRoomId === room.id
                          ? 'bg-emerald-900/20 border-emerald-500/40 text-emerald-400 shadow-inner'
                          : 'border-transparent text-ghost hover:bg-elevated hover:text-primary'
                      )}
                    >
                      <div className="flex flex-col">
                        <span className="text-xs font-bold truncate max-w-[140px]">{room.id}</span>
                        <span className="text-[10px] font-mono opacity-50 uppercase tracking-tighter">
                          {room.phase}
                        </span>
                      </div>
                      <ChevronRight
                        className={cn(
                          'w-3.5 h-3.5 transition-transform',
                          selectedRoomId === room.id
                            ? 'translate-x-1'
                            : 'opacity-20 group-hover:opacity-60'
                        )}
                      />
                    </button>
                  ))}
                  {rooms.length === 0 && (
                    <div className="p-8 text-center text-ghost text-[10px] font-mono italic">
                      No active sessions
                    </div>
                  )}
                </div>
              </div>

              <div className="md:col-span-2 bg-black/60 border border-subtle rounded-3xl flex flex-col overflow-hidden shadow-2xl relative">
                <div className="p-4 border-b border-subtle bg-elevated/30 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <MessageSquare className="w-4 h-4 text-emerald-500" />
                    <span className="text-[10px] font-mono text-ghost uppercase font-bold tracking-widest">
                      {selectedRoomId
                        ? `PERSISTED_LOG: ${selectedRoomId}`
                        : 'WAITING_FOR_SELECTION'}
                    </span>
                  </div>
                  {selectedRoomId && (
                    <button
                      onClick={() => handleGetChatLogs(selectedRoomId)}
                      className="text-ghost hover:text-emerald-400 transition-colors"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                <div className="flex-1 overflow-y-auto p-5 space-y-2.5 font-mono text-[11px] scrollbar-hide">
                  {chatLogs.map((log, idx) => (
                    <div
                      key={idx}
                      className="flex gap-4 items-start animate-in fade-in slide-in-from-left-3 duration-300"
                    >
                      <span className="text-zinc-600 shrink-0 tabular-nums">
                        [
                        {new Date(log.timestamp).toLocaleTimeString([], {
                          hour12: false,
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })}
                        ]
                      </span>
                      <span className="text-emerald-500 font-bold shrink-0">{log.sender}:</span>
                      <span className="text-zinc-300 break-all leading-relaxed">{log.text}</span>
                    </div>
                  ))}
                  {selectedRoomId && chatLogs.length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center text-ghost/20 italic">
                      <Activity className="w-12 h-12 mb-4 opacity-10 animate-pulse" />
                      <p className="font-mono text-[9px] uppercase tracking-widest">
                        Terminal Idle — No Data Stream Detected
                      </p>
                    </div>
                  )}
                  {!selectedRoomId && (
                    <div className="h-full flex flex-col items-center justify-center text-ghost/20 italic">
                      <Shield className="w-12 h-12 mb-4 opacity-10" />
                      <p className="font-mono text-[9px] uppercase tracking-widest">
                        Admin Authorization Verified — Waiting for target
                      </p>
                    </div>
                  )}
                </div>
                <div className="absolute bottom-4 right-4 text-[8px] font-mono text-ghost/10 uppercase tracking-[0.5em] pointer-events-none">
                  DEBUG_MODE_ACTIVE
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
