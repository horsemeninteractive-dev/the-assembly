import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Trophy, Shield, Zap, Heart, Scroll, Star, Check,
  Copy, ExternalLink, ChevronRight, Medal, Users, Swords,
  TrendingUp, Calendar, Eye, Info,
} from 'lucide-react';
import { apiUrl, cn, getProxiedUrl } from '../utils/utils';
import { ClanEmblem } from './clans/ClanEmblem';

// ── Types ─────────────────────────────────────────────────────────────────────

interface PublicClanMember {
  username: string;
  avatarUrl: string | null;
  activeFrame: string | null;
  role: string;
  xpContributed: number;
  joinedAt: string;
}

interface PublicClan {
  id: string;
  tag: string;
  name: string;
  description: string;
  emblem: {
    iconId: string;
    iconColor: string;
    bgColor: string;
  };
  xp: number;
  level: number;
  memberCount: number;
  createdAt: string;
  members: PublicClanMember[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function StatPill({
  label,
  value,
  icon,
  accent,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  accent?: string;
}) {
  return (
    <div className="bg-elevated border border-subtle rounded-2xl p-4 flex flex-col gap-1.5">
      <div className={cn('flex items-center gap-1.5 text-xs font-mono uppercase tracking-widest', accent ?? 'text-muted')}>
        {icon}
        {label}
      </div>
      <div className="text-2xl font-mono font-bold text-primary tabular-nums leading-none">{value}</div>
    </div>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn('rounded-lg bg-elevated animate-pulse', className)}
      style={{ animation: 'pulse 2s cubic-bezier(0.4,0,0.6,1) infinite' }}
    />
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export function ClanProfile({ tag }: { tag: string }) {
  const [clan, setClan] = useState<PublicClan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const didFetch = useRef(false);

  // Set page meta
  useEffect(() => {
    document.title = `[${tag}] — The Assembly`;
    let meta = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'description';
      document.head.appendChild(meta);
    }
    meta.content = `The ${tag} clan profile on The Assembly. Members, level, and clan stats.`;
  }, [tag]);

  useEffect(() => {
    if (didFetch.current) return;
    didFetch.current = true;

    fetch(apiUrl(`/api/public/clan/${encodeURIComponent(tag)}`))
      .then((r) => {
        if (!r.ok) {
          if (r.status === 404) throw new Error('Clan not found');
          throw new Error('Failed to load clan');
        }
        return r.json();
      })
      .then((data) => setClan(data.clan))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [tag]);

  const handleShare = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div
      className="min-h-screen bg-base text-primary font-sans relative overflow-x-hidden"
      style={{
        backgroundImage: 'radial-gradient(ellipse at top, #0d0d1a 0%, #0a0a0a 60%)',
      }}
    >
      {/* Ambient glow orbs */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden="true">
        <div
          className="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #6d28d9, transparent 70%)', filter: 'blur(80px)' }}
        />
        <div
          className="absolute -bottom-40 -right-40 w-[600px] h-[600px] rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #1d4ed8, transparent 70%)', filter: 'blur(80px)' }}
        />
      </div>

      {/* Header bar */}
      <header
        className="sticky top-0 z-50 border-b border-subtle flex items-center justify-between px-6 py-3"
        style={{ background: 'rgba(10,10,10,0.85)', backdropFilter: 'blur(20px)' }}
      >
        <a
          href="/"
          className="text-xs font-mono uppercase tracking-[0.3em] text-muted hover:text-primary transition-colors flex items-center gap-2"
        >
          <div className="w-5 h-5 rounded bg-white/10 border border-subtle flex items-center justify-center">
            <span className="text-[8px] font-bold text-primary">A</span>
          </div>
          The Assembly
        </a>
        <a
          href="/"
          className="flex items-center gap-1.5 text-xs font-mono uppercase tracking-widest text-muted hover:text-primary transition-colors px-3 py-1.5 rounded-lg border border-subtle hover:border-default"
        >
          Play Now
          <ChevronRight className="w-3 h-3" />
        </a>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        <AnimatePresence mode="wait">
          {loading && (
            <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6">
              <div className="bg-elevated border border-subtle rounded-3xl p-6 flex items-center gap-5">
                <Skeleton className="w-20 h-20 rounded-2xl shrink-0" />
                <div className="flex-1 space-y-3">
                  <Skeleton className="h-7 w-40" />
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-4 w-20" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {[...Array(2)].map((_, i) => <Skeleton key={i} className="h-20 rounded-2xl" />)}
              </div>
            </motion.div>
          )}

          {error && !loading && (
            <motion.div
              key="error"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center justify-center py-24 gap-4 text-center"
            >
              <div className="w-16 h-16 rounded-2xl bg-red-900/20 border border-red-800/40 flex items-center justify-center">
                <Users className="w-8 h-8 text-red-500/60" />
              </div>
              <div>
                <div className="text-lg font-thematic tracking-wide text-primary">{error}</div>
                <div className="text-xs font-mono text-muted mt-1">Check the clan tag and try again.</div>
              </div>
              <a
                href="/"
                className="mt-2 px-5 py-2.5 bg-white text-black rounded-xl text-sm font-mono font-bold hover:bg-gray-200 transition-colors"
              >
                Return Home
              </a>
            </motion.div>
          )}

          {clan && !loading && (
            <motion.div key="clan" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5">
              {/* ── Hero Card ──────────────────────────────────────────── */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-elevated border border-subtle rounded-3xl p-6 relative overflow-hidden shadow-2xl"
              >
                <div className="relative flex items-start gap-6">
                  {/* Emblem */}
                  <div className="shrink-0 scale-150 origin-top-left pt-2">
                    <ClanEmblem emblem={clan.emblem} size="md" />
                  </div>

                  {/* Identity */}
                  <div className="flex-1 min-w-0">
                    <div className="text-[10px] font-mono uppercase tracking-[0.25em] text-muted mb-0.5">
                      Clan Profile
                    </div>
                    <div className="text-2xl font-thematic tracking-wide text-primary leading-tight break-all">
                      {clan.name}
                    </div>
                    <div className="text-sm font-mono text-secondary font-bold mt-1">
                      [{clan.tag}]
                    </div>

                    <div className="flex items-center gap-3 mt-3">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-mono uppercase tracking-widest text-faint">Level</span>
                        <span className="text-lg font-thematic text-yellow-500 leading-none">{clan.level}</span>
                      </div>
                      <div className="w-px h-6 bg-subtle" />
                      <div className="flex flex-col">
                        <span className="text-[10px] font-mono uppercase tracking-widest text-faint">Members</span>
                        <span className="text-lg font-thematic text-primary leading-none">{clan.memberCount}</span>
                      </div>
                    </div>

                    <div className="mt-4 text-sm text-muted italic leading-relaxed">
                      "{clan.description || 'No description provided.'}"
                    </div>
                  </div>
                </div>

                {/* Action row */}
                <div className="flex gap-2 mt-6">
                  <button
                    onClick={handleShare}
                    className={cn(
                      'flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border text-xs font-mono uppercase tracking-widest transition-all',
                      copied
                        ? 'bg-emerald-900/30 border-emerald-700/50 text-emerald-400'
                        : 'bg-card border-subtle text-muted hover:text-primary hover:border-default'
                    )}
                  >
                    {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    {copied ? 'Copied Link' : 'Share Clan'}
                  </button>
                  <a
                    href="/"
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white text-black text-xs font-mono uppercase tracking-widest hover:bg-gray-200 transition-colors font-bold"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    Play Now
                  </a>
                </div>
              </motion.div>

              {/* ── Members List ───────────────────────────────────────── */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Users className="w-3.5 h-3.5 text-muted" />
                  <span className="text-[10px] font-mono uppercase tracking-[0.25em] text-muted">
                    Clan Roster
                  </span>
                  <div className="flex-1 h-px bg-subtle" />
                </div>

                <div className="grid gap-2">
                  {clan.members.map((m, idx) => (
                    <motion.a
                      key={m.username}
                      href={`/player/${m.username}`}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.03 }}
                      className="flex items-center gap-3 p-3 bg-elevated border border-subtle rounded-2xl hover:border-default transition-all group"
                    >
                      <div className="w-10 h-10 rounded-xl bg-card border border-subtle overflow-hidden flex items-center justify-center">
                        {m.avatarUrl ? (
                          <img src={getProxiedUrl(m.avatarUrl)} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-secondary font-thematic">{m.username[0]}</span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-bold text-primary group-hover:text-brand transition-colors">
                          {m.username}
                        </div>
                        <div className="text-[10px] font-mono uppercase tracking-widest text-muted">
                          {m.role}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs font-mono font-bold text-yellow-500/80">
                          {m.xpContributed.toLocaleString()} XP
                        </div>
                        <div className="text-[9px] font-mono text-faint">
                          Contrib.
                        </div>
                      </div>
                    </motion.a>
                  ))}
                </div>
              </div>

              {/* ── Footer ────────────────────────────────────────────── */}
              <div className="text-center py-6">
                <div className="text-[10px] font-mono text-faint">
                  Clan founded on {new Date(clan.createdAt).toLocaleDateString()}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
