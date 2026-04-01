import React from 'react';
import { Search, Users, Shield, Ban, ChevronRight } from 'lucide-react';
import { User } from '../../../../shared/types';
import { cn, apiUrl, debugLog, debugError } from '../../../utils/utils';

interface AdminUserSearchProps {
  adminId: string;
  token: string;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  results: User[];
  setResults: (users: User[]) => void;
  selectedUser: User | null;
  setSelectedUser: (user: User | null) => void;
  loading: boolean;
  setLoading: (l: boolean) => void;
  hasSearched: boolean;
  setHasSearched: (h: boolean) => void;
}

export const AdminUserSearch: React.FC<AdminUserSearchProps> = ({
  adminId, token, searchQuery, setSearchQuery, results, setResults,
  selectedUser, setSelectedUser, loading, setLoading, hasSearched, setHasSearched
}) => {
  const handleSearchUsers = async () => {
    if (!searchQuery.trim() || !adminId) return;
    setLoading(true);
    setHasSearched(true);
    try {
      const res = await fetch(
        apiUrl(`/api/admin/users/search?adminId=${adminId}&q=${searchQuery}`),
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.ok) {
        const data = await res.json();
        setResults(data);
        if (data.length > 0) setSelectedUser(data[0]);
      }
    } catch (err) {
      debugError('Failed to search users:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex gap-3 mb-8">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ghost" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
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

      <div className="space-y-2.5">
        <div className="text-[10px] font-mono text-faint uppercase font-bold tracking-[0.2em] mb-2 px-2">
          Results
        </div>
        {results.map((user) => (
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
                src={user.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.username}`}
                className="w-10 h-10 rounded-xl bg-elevated border border-subtle"
                alt=""
              />
              <div className="flex flex-col">
                <span className={cn('text-sm font-bold', selectedUser?.id === user.id ? 'text-yellow-400' : 'text-primary')}>
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
                  selectedUser?.id === user.id ? 'translate-x-0.5 text-yellow-500' : 'text-ghost opacity-20'
                )}
              />
            </div>
          </button>
        ))}
        {results.length === 0 && !loading && (
          <div className="py-16 text-center bg-elevated/20 border border-dashed border-subtle rounded-3xl">
            <Users className="w-8 h-8 text-ghost/20 mx-auto mb-3" />
            <p className="text-ghost text-[10px] font-mono uppercase tracking-widest italic">
              {hasSearched ? 'No players found matching criteria' : 'Enter criteria above'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};


