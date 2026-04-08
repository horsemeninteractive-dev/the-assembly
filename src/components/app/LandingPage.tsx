import React, { useRef } from 'react';
import { motion, useScroll, useTransform } from 'motion/react';
import { Scale, Eye, Crown, Vote, FileText, Users, Zap, Bot, Shield, Sparkles, ChevronDown } from 'lucide-react';
import { OverseerIcon } from '../icons';
import { getProxiedUrl } from '../../utils/utils';

interface LandingPageProps {
  onPlayNow: () => void;
  onLogin: () => void;
}

/* ─── Reusable section wrapper ─────────────────────────────────── */
const Section: React.FC<{ children: React.ReactNode; className?: string; id?: string }> = ({
  children,
  className = '',
  id,
}) => (
  <section id={id} className={`relative z-10 w-full max-w-5xl mx-auto px-5 py-20 ${className}`}>
    {children}
  </section>
);

/* ─── Section heading ───────────────────────────────────────────── */
const SectionHeading: React.FC<{ label: string; title: string; subtitle?: string }> = ({
  label,
  title,
  subtitle,
}) => (
  <motion.div
    initial={{ opacity: 0, y: 24 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, margin: '-80px' }}
    transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
    className="text-center mb-12"
  >
    <p className="text-xs font-mono uppercase tracking-[0.25em] text-white/40 mb-3">{label}</p>
    <h2 className="text-3xl md:text-4xl font-thematic text-white uppercase tracking-wide mb-4">
      {title}
    </h2>
    {subtitle && (
      <p className="text-white/55 text-base leading-relaxed max-w-xl mx-auto font-sans">{subtitle}</p>
    )}
  </motion.div>
);

/* ─── Game loop steps ────────────────────────────────────────────── */
const LOOP_STEPS = [
  {
    num: '01',
    label: 'Nomination',
    color: 'from-yellow-600/20 to-yellow-900/5 border-yellow-500/25 text-yellow-400',
    dot: 'bg-yellow-500',
    desc: 'The President nominates a Chancellor. Who you trust — and who you nominate — reveals everything.',
  },
  {
    num: '02',
    label: 'Vote',
    color: 'from-purple-600/20 to-purple-900/5 border-purple-500/25 text-purple-400',
    dot: 'bg-purple-500',
    desc: 'All players vote simultaneously. Public, inescapable, and open to interpretation.',
  },
  {
    num: '03',
    label: 'Legislative Session',
    color: 'from-blue-600/20 to-blue-900/5 border-blue-500/25 text-blue-400',
    dot: 'bg-blue-500',
    desc: 'The President draws 3 policy cards, discards 1, passes 2 to the Chancellor. One will be enacted.',
  },
  {
    num: '04',
    label: 'Declarations',
    color: 'from-emerald-600/20 to-emerald-900/5 border-emerald-500/25 text-emerald-400',
    dot: 'bg-emerald-500',
    desc: "Both sides declare what happened in the session. These statements can be lies — blatant, convincing lies.",
  },
  {
    num: '05',
    label: 'Executive Action',
    color: 'from-red-600/20 to-red-900/5 border-red-500/25 text-red-400',
    dot: 'bg-red-500',
    desc: 'Enough State policies and the President wields power — investigations, detentions, executions.',
  },
];

/* ─── Features ──────────────────────────────────────────────────── */
const FEATURES = [
  { icon: <Users className="w-5 h-5" />, label: '5–10 Players', desc: 'Scale from tight deduction to sprawling deception.' },
  { icon: <Bot className="w-5 h-5" />, label: 'AI Players', desc: 'Fill empty seats with AI — each with its own personality.' },
  { icon: <Zap className="w-5 h-5" />, label: 'Title Roles', desc: 'One-use powers — Interdictor, Assassin, Broker and more.' },
  { icon: <FileText className="w-5 h-5" />, label: 'Personal Agendas', desc: '20 hidden objectives independent of your faction.' },
  { icon: <Vote className="w-5 h-5" />, label: 'Crisis Mode', desc: 'Optional chaos directives that rewrite the rules mid-game.' },
  { icon: <Shield className="w-5 h-5" />, label: 'Clan System', desc: 'Form a clan, set a banner, build a legacy.' },
  { icon: <Crown className="w-5 h-5" />, label: 'Season Ranks', desc: 'Climb the ladder. Earn IP. Unlock cosmetics.' },
  { icon: <Sparkles className="w-5 h-5" />, label: 'Free to Play', desc: 'All gameplay is free. Cosmetics are optional.' },
];

/* ─── Main component ─────────────────────────────────────────────── */
export const LandingPage: React.FC<LandingPageProps> = ({ onPlayNow, onLogin }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ container: containerRef });
  const heroParallax = useTransform(scrollYProgress, [0, 0.3], ['0%', '-15%']);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.25], [1, 0]);

  return (
    <div
      ref={containerRef}
      className="h-[100dvh] overflow-y-auto overflow-x-hidden bg-[#07070a] font-sans custom-scrollbar"
      style={{ scrollBehavior: 'smooth' }}
    >
      {/* ── Top nav bar ─────────────────────────────────────────── */}
      <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4"
        style={{ background: 'linear-gradient(to bottom, rgba(7,7,10,0.9) 0%, transparent 100%)', backdropFilter: 'blur(0px)' }}>
        <div className="flex items-center gap-3">
          <img
            src={getProxiedUrl('https://storage.googleapis.com/secretchancellor/SC.png')}
            alt="The Assembly"
            className="w-8 h-8 object-contain"
            referrerPolicy="no-referrer"
          />
          <span className="font-thematic text-white/80 text-sm uppercase tracking-[0.2em] hidden sm:block">
            The Assembly
          </span>
        </div>
        <div className="flex items-center gap-3">
          <button
            id="nav-login"
            onClick={onLogin}
            className="text-white/60 hover:text-white text-sm font-mono transition-colors duration-200 px-3 py-1.5"
          >
            Log In
          </button>
          <button
            id="nav-play-now"
            onClick={onPlayNow}
            className="bg-white text-black text-sm font-thematic uppercase tracking-widest px-4 py-2 rounded-xl hover:bg-white/90 transition-all duration-200 shadow-lg shadow-black/40"
          >
            Play Now
          </button>
        </div>
      </nav>

      {/* ── Hero ────────────────────────────────────────────────── */}
      <section className="relative h-[100dvh] flex items-center justify-center overflow-hidden">
        {/* Parallax hero image */}
        <motion.div
          className="absolute inset-0 scale-110"
          style={{ y: heroParallax }}
        >
          <img
            src="/hero.png"
            alt="The Assembly Chamber"
            className="w-full h-full object-cover"
          />
          {/* Multi-layer overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#07070a] via-[#07070a]/60 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-blue-950/30 via-transparent to-red-950/30" />
        </motion.div>

        {/* Hero content */}
        <motion.div
          style={{ opacity: heroOpacity }}
          className="relative z-10 text-center px-6 max-w-4xl mx-auto"
        >
          {/* Logo */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
            className="w-20 h-20 md:w-24 md:h-24 bg-black/60 backdrop-blur-md rounded-3xl flex items-center justify-center border border-white/10 mx-auto mb-8 shadow-[0_0_60px_rgba(255,255,255,0.05)]"
          >
            <img
              src={getProxiedUrl('https://storage.googleapis.com/secretchancellor/SC.png')}
              alt="The Assembly"
              className="w-full h-full object-contain p-3"
              referrerPolicy="no-referrer"
            />
          </motion.div>

          {/* Title */}
          <motion.h1
            initial={{ opacity: 0, letterSpacing: '0.5em' }}
            animate={{ opacity: 1, letterSpacing: '0.12em' }}
            transition={{ duration: 1.4, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="text-5xl md:text-7xl font-thematic text-white uppercase mb-6 drop-shadow-2xl"
          >
            The Assembly
          </motion.h1>

          {/* Divider */}
          <motion.div
            initial={{ scaleX: 0, opacity: 0 }}
            animate={{ scaleX: 1, opacity: 1 }}
            transition={{ duration: 1, delay: 0.9 }}
            className="w-20 h-px mx-auto mb-6"
            style={{ background: 'linear-gradient(to right, transparent, rgba(255,255,255,0.4), transparent)' }}
          />

          {/* Tagline */}
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 1.1 }}
            className="text-white/60 text-lg md:text-xl font-sans italic mb-10 leading-relaxed"
          >
            A social deduction game of hidden roles, political intrigue,
            <br className="hidden md:block" /> and impossible trust.
          </motion.p>

          {/* CTAs */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 1.5 }}
            className="flex flex-col sm:flex-row gap-4 justify-center items-center"
          >
            <button
              id="hero-play-now"
              onClick={onPlayNow}
              className="relative overflow-hidden w-full sm:w-auto bg-white text-black font-thematic text-lg uppercase tracking-[0.2em] px-10 py-4 rounded-2xl hover:bg-white/90 transition-all duration-300 shadow-[0_0_40px_rgba(255,255,255,0.2)] hover:shadow-[0_0_60px_rgba(255,255,255,0.35)] animate-shine"
            >
              Play Now — Free
            </button>
            <button
              id="hero-login"
              onClick={onLogin}
              className="w-full sm:w-auto bg-white/5 hover:bg-white/10 border border-white/20 hover:border-white/40 text-white font-thematic text-lg uppercase tracking-[0.2em] px-10 py-4 rounded-2xl transition-all duration-300"
            >
              Log In
            </button>
          </motion.div>
        </motion.div>

        {/* Scroll indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 2.5, duration: 1 }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-white/30"
        >
          <span className="text-xs font-mono uppercase tracking-widest">Discover</span>
          <motion.div
            animate={{ y: [0, 8, 0] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
          >
            <ChevronDown className="w-5 h-5" />
          </motion.div>
        </motion.div>
      </section>

      {/* ── What Is It ──────────────────────────────────────────── */}
      <Section id="about">
        <SectionHeading
          label="What Is The Assembly?"
          title="Hidden Roles. Public Stakes."
          subtitle="A political thriller played out in real time. 5 to 10 players take on secret roles and must deceive, deduce, and outmanoeuvre one another across a series of high-pressure legislative rounds."
        />

        {/* Featured stat cards */}
        <motion.div
          initial={{ opacity: 0, y: 32 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="grid grid-cols-1 sm:grid-cols-3 gap-4"
        >
          {[
            { value: '5–10', label: 'Players per game', accent: 'text-white' },
            { value: '17', label: 'Policy cards stacked against you', accent: 'text-red-400' },
            { value: '20', label: 'Personal agendas to complete', accent: 'text-emerald-400' },
          ].map(({ value, label, accent }) => (
            <div
              key={label}
              className="bg-white/[0.04] border border-white/10 rounded-2xl p-6 text-center backdrop-blur-sm"
            >
              <div className={`text-4xl font-thematic ${accent} mb-2`}>{value}</div>
              <div className="text-white/45 text-sm font-sans">{label}</div>
            </div>
          ))}
        </motion.div>

        {/* Flavour quote */}
        <motion.blockquote
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="mt-12 text-center text-white/35 text-sm font-sans italic leading-relaxed border-t border-white/8 pt-10"
        >
          "The old world ended with The Crisis. Now, only The Assembly stands…<br />
          <span className="text-white/50">Will you defend the Civil Charter, or will you build the new State?</span>"
        </motion.blockquote>
      </Section>

      {/* ── Factions ────────────────────────────────────────────── */}
      <Section id="factions">
        <SectionHeading
          label="Choose Your Side"
          title="Two Factions. One Assembly."
          subtitle="Every player is secretly assigned to a faction at the start of each game. The majority will not know who they can trust."
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Civil */}
          <motion.div
            initial={{ opacity: 0, x: -40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            className="rounded-3xl border border-blue-500/20 overflow-hidden"
            style={{ background: 'linear-gradient(135deg, rgba(30,58,138,0.25) 0%, rgba(7,7,10,0.6) 100%)' }}
          >
            <div className="p-6 md:p-8">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-blue-500/15 border border-blue-500/25 flex items-center justify-center">
                  <Scale className="w-5 h-5 text-blue-400" />
                </div>
                <div className="font-thematic text-blue-400 text-xl uppercase tracking-wider">Civil</div>
              </div>
              <p className="text-white/55 text-sm leading-relaxed mb-5">
                The majority. Isolated in your loyalty. You don't know who your allies are — only that the deck is stacked against you, and that someone at this table is a traitor.
              </p>
              <div className="space-y-2">
                <div className="text-xs font-mono uppercase tracking-widest text-white/30 mb-2">Win Conditions</div>
                <div className="flex items-center gap-2 text-sm text-white/60">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-400/60 shrink-0" />
                  Enact 5 Civil directives
                </div>
                <div className="flex items-center gap-2 text-sm text-white/60">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-400/60 shrink-0" />
                  Execute the Overseer
                </div>
              </div>
            </div>
          </motion.div>

          {/* State */}
          <motion.div
            initial={{ opacity: 0, x: 40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            className="rounded-3xl border border-red-500/20 overflow-hidden"
            style={{ background: 'linear-gradient(135deg, rgba(127,29,29,0.25) 0%, rgba(7,7,10,0.6) 100%)' }}
          >
            <div className="p-6 md:p-8">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-red-500/15 border border-red-500/25 flex items-center justify-center">
                  <Eye className="w-5 h-5 text-red-400" />
                </div>
                <div className="font-thematic text-red-400 text-xl uppercase tracking-wider">State</div>
              </div>
              <p className="text-white/55 text-sm leading-relaxed mb-5">
                The minority. Hidden among the Civil delegates, secretly coordinating. You know your allies. What you need is the right moment.
              </p>
              <div className="space-y-2">
                <div className="text-xs font-mono uppercase tracking-widest text-white/30 mb-2">Win Conditions</div>
                <div className="flex items-center gap-2 text-sm text-white/60">
                  <div className="w-1.5 h-1.5 rounded-full bg-red-400/60 shrink-0" />
                  Enact 6 State directives
                </div>
                <div className="flex items-center gap-2 text-sm text-white/60">
                  <div className="w-1.5 h-1.5 rounded-full bg-red-400/60 shrink-0" />
                  Elect the Overseer as Chancellor
                </div>
              </div>
            </div>
            {/* Overseer note */}
            <div className="mx-6 md:mx-8 mb-6 md:mb-8 -mt-1 rounded-xl bg-red-950/40 border border-red-600/20 p-4">
              <div className="flex items-center gap-2 mb-1">
                <OverseerIcon className="w-4 h-4 text-red-500" />
                <span className="text-red-500 font-bold text-xs uppercase tracking-widest">The Overseer</span>
              </div>
              <p className="text-white/40 text-xs leading-relaxed">
                A State agent who may not know the other State players. Their election as Chancellor after 3 State directives ends the game immediately.
              </p>
            </div>
          </motion.div>
        </div>
      </Section>

      {/* ── Game Loop ───────────────────────────────────────────── */}
      <Section id="how-to-play">
        <SectionHeading
          label="How It Plays"
          title="One Round. Five Moments."
          subtitle="Each round forces every player to participate, declare, and be judged. There is no hiding."
        />

        <div className="relative">
          {/* Connecting line */}
          <div className="absolute left-6 top-8 bottom-8 w-px bg-gradient-to-b from-yellow-500/30 via-blue-500/30 to-red-500/30 hidden md:block" />

          <div className="space-y-4">
            {LOOP_STEPS.map((step, i) => (
              <motion.div
                key={step.num}
                initial={{ opacity: 0, x: -24 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: '-40px' }}
                transition={{ duration: 0.5, delay: i * 0.08, ease: [0.16, 1, 0.3, 1] }}
                className={`relative flex gap-5 bg-gradient-to-r ${step.color} border rounded-2xl p-5`}
              >
                {/* Dot */}
                <div className={`w-3 h-3 rounded-full ${step.dot} shrink-0 mt-1 shadow-lg`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-3 mb-1">
                    <span className="text-xs font-mono text-white/25">{step.num}</span>
                    <span className="font-thematic text-base uppercase tracking-wide">{step.label}</span>
                  </div>
                  <p className="text-white/50 text-sm leading-relaxed">{step.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </Section>

      {/* ── Features ────────────────────────────────────────────── */}
      <Section id="features">
        <SectionHeading
          label="What's Included"
          title="More Than a Board Game."
        />

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {FEATURES.map((f, i) => (
            <motion.div
              key={f.label}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ duration: 0.5, delay: i * 0.06, ease: [0.16, 1, 0.3, 1] }}
              className="bg-white/[0.04] hover:bg-white/[0.07] border border-white/8 hover:border-white/15 rounded-2xl p-4 transition-all duration-300 group cursor-default"
            >
              <div className="text-white/40 group-hover:text-white/70 transition-colors mb-3">{f.icon}</div>
              <div className="text-white/80 text-sm font-thematic uppercase tracking-wide mb-1">{f.label}</div>
              <div className="text-white/35 text-xs leading-relaxed">{f.desc}</div>
            </motion.div>
          ))}
        </div>
      </Section>

      {/* ── Final CTA ────────────────────────────────────────────── */}
      <Section id="cta">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="rounded-3xl border border-white/10 overflow-hidden text-center relative"
          style={{ background: 'linear-gradient(135deg, rgba(30,58,138,0.2) 0%, rgba(7,7,10,0.8) 50%, rgba(127,29,29,0.2) 100%)' }}
        >
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10" />
          <div className="relative z-10 p-10 md:p-16">
            <div className="w-12 h-px mx-auto mb-8" style={{ background: 'linear-gradient(to right, transparent, rgba(255,255,255,0.3), transparent)' }} />
            <h2 className="text-3xl md:text-5xl font-thematic text-white uppercase tracking-wide mb-4">
              Take Your Seat.
            </h2>
            <p className="text-white/50 text-base mb-10 max-w-sm mx-auto leading-relaxed">
              Free to play. No downloads. The Assembly awaits.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button
                id="cta-play-now"
                onClick={onPlayNow}
                className="relative overflow-hidden bg-white text-black font-thematic text-lg uppercase tracking-[0.2em] px-10 py-4 rounded-2xl hover:bg-white/90 transition-all duration-300 shadow-[0_0_40px_rgba(255,255,255,0.15)] hover:shadow-[0_0_60px_rgba(255,255,255,0.3)] animate-shine"
              >
                Create Account
              </button>
              <button
                id="cta-login"
                onClick={onLogin}
                className="bg-white/5 hover:bg-white/10 border border-white/15 hover:border-white/30 text-white font-thematic text-lg uppercase tracking-[0.2em] px-10 py-4 rounded-2xl transition-all duration-300"
              >
                Log In
              </button>
            </div>
          </div>
        </motion.div>

        {/* Footer note */}
        <div className="mt-10 text-center text-white/20 text-xs font-mono space-y-1">
          <p>© The Assembly — Horsemen Interactive</p>
          <p>A social deduction game. For entertainment purposes.</p>
        </div>
      </Section>
    </div>
  );
};
