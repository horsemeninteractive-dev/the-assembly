import React, { useState, useEffect } from 'react';
import { Trash2, Megaphone, Users, Clock, Shield, AlertTriangle, RefreshCw, Search } from 'lucide-react';
import { socket } from '../socket';
import { cn, apiUrl } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

import { RoomInfo } from '../types';

export const AdminTools: React.FC = () => {
  const [rooms, setRooms] = useState<RoomInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
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
      console.error('Failed to fetch rooms:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRooms();
    const interval = setInterval(fetchRooms, 15000);
    return () => clearInterval(interval);
  }, []);

  const handleDeleteRoom = (roomId: string) => {
    socket.emit('adminDeleteRoom', roomId);
    setConfirmDelete(null);
    // Optimistic update
    setRooms(prev => prev.filter(r => r.id !== roomId));
  };

  const handleBroadcast = () => {
    if (!broadcastMessage.trim()) return;
    setIsBroadcasting(true);
    socket.emit('adminBroadcast', broadcastMessage);
    setBroadcastMessage('');
    setTimeout(() => setIsBroadcasting(false), 2000);
  };

  const filteredRooms = rooms.filter(r => 
    (r.id?.toLowerCase().includes(searchQuery.toLowerCase()) || 
     r.name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
     r.hostName?.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Broadcast Section */}
      <section className="bg-elevated/50 border border-yellow-500/20 rounded-3xl p-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4 opacity-5">
          <Megaphone className="w-24 h-24" />
        </div>
        <div className="flex items-center gap-3 mb-6 relative z-10">
          <div className="w-10 h-10 rounded-xl bg-yellow-500/20 flex items-center justify-center border border-yellow-500/30">
            <Megaphone className="w-5 h-5 text-yellow-500" />
          </div>
          <div>
            <h3 className="text-xl font-thematic text-primary uppercase tracking-wider">System Broadcast</h3>
            <p className="text-[10px] font-mono text-faint uppercase">Send a message to all active sessions</p>
          </div>
        </div>
        
        <div className="flex gap-4 relative z-10">
          <input
            type="text"
            value={broadcastMessage}
            onChange={(e) => setBroadcastMessage(e.target.value)}
            placeholder="Enter announcement message..."
            className="flex-1 bg-card border border-subtle text-primary px-4 py-3 rounded-2xl font-mono text-sm focus:outline-none focus:border-yellow-500/50 transition-all shadow-inner"
            onKeyDown={(e) => e.key === 'Enter' && handleBroadcast()}
          />
          <button
            onClick={handleBroadcast}
            disabled={!broadcastMessage.trim() || isBroadcasting}
            className={cn(
              "btn-primary px-8 rounded-2xl font-thematic uppercase tracking-widest transition-all shadow-lg",
              isBroadcasting ? "bg-emerald-600 border-emerald-500" : "bg-yellow-600 border-yellow-500 text-black hover:bg-yellow-500"
            )}
          >
            {isBroadcasting ? 'Sent!' : 'Broadcast'}
          </button>
        </div>
      </section>

      {/* Room Management Section */}
      <section className="space-y-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center border border-red-500/30">
              <Shield className="w-5 h-5 text-red-500" />
            </div>
            <div>
              <h3 className="text-xl font-thematic text-primary uppercase tracking-wider">Active Rooms</h3>
              <p className="text-[10px] font-mono text-faint uppercase">{rooms.length} rooms current active</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
             <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-ghost" />
              <input
                type="text"
                placeholder="Search rooms..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-card border border-subtle text-primary pl-9 pr-4 py-2 rounded-xl text-xs font-mono focus:outline-none focus:border-primary/50 w-48 transition-all"
              />
            </div>
            <button 
              onClick={fetchRooms}
              className={cn(
                "p-2.5 rounded-xl bg-card border border-subtle text-ghost hover:text-primary transition-all hover:bg-elevated",
                loading && "animate-spin"
              )}
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3">
          {filteredRooms.length > 0 ? filteredRooms.map((room) => (
            <div key={room.id} className="bg-card border border-subtle rounded-2xl p-4 flex items-center justify-between group hover:border-ghost/30 transition-all hover:shadow-lg">
              <div className="flex items-center gap-6">
                <div className="px-3 py-1.5 rounded-lg bg-elevated border border-subtle">
                  <span className="text-xs font-mono font-bold text-primary">{room.id}</span>
                </div>
                
                <div className="flex items-center gap-4">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-mono text-faint uppercase">Host</span>
                    <span className="text-sm font-medium text-muted">{room.hostName}</span>
                  </div>
                  
                  <div className="h-8 w-px bg-subtle/50" />
                  
                  <div className="flex flex-col">
                    <span className="text-[10px] font-mono text-faint uppercase">Players</span>
                    <div className="flex items-center gap-1.5 text-xs font-mono text-primary">
                      <Users className="w-3 h-3 text-ghost" />
                      {room.playerCount}
                    </div>
                  </div>

                  <div className="h-8 w-px bg-subtle/50" />

                  <div className="flex flex-col">
                    <span className="text-[10px] font-mono text-faint uppercase">Phase</span>
                    <div className={cn(
                      "text-[10px] px-2 py-0.5 rounded-md font-mono border uppercase",
                      room.phase === 'Lobby' ? "bg-emerald-900/20 border-emerald-500/30 text-emerald-400" : "bg-blue-900/20 border-blue-500/30 text-blue-400"
                    )}>
                      {room.phase}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <AnimatePresence mode="wait">
                  {confirmDelete === room.id ? (
                     <motion.div 
                      key="confirm"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      className="flex items-center gap-2"
                    >
                      <button
                        onClick={() => handleDeleteRoom(room.id)}
                        className="px-3 py-1.5 rounded-lg bg-red-600 text-white text-[10px] font-mono uppercase font-bold hover:bg-red-50 transition-all shadow-lg shadow-red-900/20"
                      >
                        Confirm
                      </button>
                      <button
                        onClick={() => setConfirmDelete(null)}
                        className="px-3 py-1.5 rounded-lg bg-elevated border border-subtle text-[10px] font-mono uppercase hover:bg-card transition-all"
                      >
                        Cancel
                      </button>
                    </motion.div>
                  ) : (
                    <motion.button
                      key="delete"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      onClick={() => setConfirmDelete(room.id)}
                      className="p-2.5 rounded-xl text-red-500/50 hover:text-red-500 hover:bg-red-900/10 transition-all opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 className="w-4.5 h-4.5" />
                    </motion.button>
                  )}
                </AnimatePresence>
              </div>
            </div>
          )) : (
            <div className="py-12 text-center bg-elevated/30 border border-dashed border-subtle rounded-3xl">
              <AlertTriangle className="w-10 h-10 text-ghost/20 mx-auto mb-3" />
              <p className="text-ghost text-sm font-serif italic">No active rooms found</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};
