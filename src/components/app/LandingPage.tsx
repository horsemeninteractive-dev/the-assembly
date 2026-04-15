import React, { useRef } from 'react';
import { motion, useScroll, useTransform } from 'motion/react';
import { Scale, Eye, Crown, Vote, FileText, Users, Zap, Bot, Shield, Sparkles, ChevronDown } from 'lucide-react';
import { OverseerIcon } from '../icons';
import { getProxiedUrl } from '../../utils/utils';
import { useTranslation } from '../../contexts/I18nContext';
import { LanguageSwitcher } from '../common/LanguageSwitcher';

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

/* ─── Main component ─────────────────────────────────────────────── */
export const LandingPage: React.FC<LandingPageProps> = ({ onPlayNow, onLogin }) => {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ container: containerRef });
  const heroParallax = useTransform(scrollYProgress, [0, 0.3], ['0%', '-15%']);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.25], [1, 0]);

  /* ─── Game loop steps ────────────────────────────────────────────── */
  const LOOP_STEPS = [
    {
      num: '01',
      label: t('landing.loop.label_1'),
      color: 'from-yellow-600/20 to-yellow-900/5 border-yellow-500/25 text-yellow-400',
      dot: 'bg-yellow-500',
      desc: t('landing.loop.step_1'),
    },
    {
      num: '02',
      label: t('landing.loop.label_2'),
      color: 'from-purple-600/20 to-purple-900/5 border-purple-500/25 text-purple-400',
      dot: 'bg-purple-500',
      desc: t('landing.loop.step_2'),
    },
    {
      num: '03',
      label: t('landing.loop.label_3'),
      color: 'from-blue-600/20 to-blue-900/5 border-blue-500/25 text-blue-400',
      dot: 'bg-blue-500',
      desc: t('landing.loop.step_3'),
    },
    {
      num: '04',
      label: t('landing.loop.label_4'),
      color: 'from-emerald-600/20 to-emerald-900/5 border-emerald-500/25 text-emerald-400',
      dot: 'bg-emerald-500',
      desc: t('landing.loop.step_4'),
    },
    {
      num: '05',
      label: t('landing.loop.label_5'),
      color: 'from-red-600/20 to-red-900/5 border-red-500/25 text-red-400',
      dot: 'bg-red-500',
      desc: t('landing.loop.step_5'),
    },
  ];

  /* ─── Features ──────────────────────────────────────────────────── */
  const FEATURES = [
    { icon: <Users className="w-5 h-5" />, label: t('landing.features.item_1.label'), desc: t('landing.features.item_1.desc') },
    { icon: <Bot className="w-5 h-5" />, label: t('landing.features.item_2.label'), desc: t('landing.features.item_2.desc') },
    { icon: <Zap className="w-5 h-5" />, label: t('landing.features.item_3.label'), desc: t('landing.features.item_3.desc') },
    { icon: <FileText className="w-5 h-5" />, label: t('landing.features.item_4.label'), desc: t('landing.features.item_4.desc') },
    { icon: <Vote className="w-5 h-5" />, label: t('landing.features.item_5.label'), desc: t('landing.features.item_5.desc') },
    { icon: <Shield className="w-5 h-5" />, label: t('landing.features.item_6.label'), desc: t('landing.features.item_6.desc') },
    { icon: <Crown className="w-5 h-5" />, label: t('landing.features.item_7.label'), desc: t('landing.features.item_7.desc') },
    { icon: <Sparkles className="w-5 h-5" />, label: t('landing.features.item_8.label'), desc: t('landing.features.item_8.desc') },
  ];

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
            {t('common.title')}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <LanguageSwitcher variant="ghost" />
          <button
            id="nav-login"
            onClick={onLogin}
            className="text-white/60 hover:text-white text-sm font-mono transition-colors duration-200 px-3 py-1.5"
          >
            {t('landing.nav.login')}
          </button>
          <button
            id="nav-play-now"
            onClick={onPlayNow}
            className="bg-white text-black text-sm font-thematic uppercase tracking-widest px-4 py-2 rounded-xl hover:bg-white/90 transition-all duration-200 shadow-lg shadow-black/40"
          >
            {t('landing.nav.play')}
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
            {t('common.title')}
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
            className="text-white/60 text-lg md:text-xl font-sans italic mb-10 leading-relaxed whitespace-pre-line"
          >
            {t('landing.hero.tagline')}
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
              {t('landing.hero.cta_play')}
            </button>
            <button
              id="hero-login"
              onClick={onLogin}
              className="w-full sm:w-auto bg-white/5 hover:bg-white/10 border border-white/20 hover:border-white/40 text-white font-thematic text-lg uppercase tracking-[0.2em] px-10 py-4 rounded-2xl transition-all duration-300"
            >
              {t('landing.nav.login')}
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
          <span className="text-xs font-mono uppercase tracking-widest">{t('landing.hero.discover')}</span>
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
          label={t('landing.about.label')}
          title={t('landing.about.title')}
          subtitle={t('landing.about.subtitle')}
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
            { value: '5–10', label: t('landing.about.stat_players'), accent: 'text-white' },
            { value: '17', label: t('landing.about.stat_policies'), accent: 'text-red-400' },
            { value: '20', label: t('landing.about.stat_agendas'), accent: 'text-emerald-400' },
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
          "{t('landing.about.quote')}<br />
          <span className="text-white/50">{t('landing.about.quote_cta')}</span>"
        </motion.blockquote>
      </Section>

      {/* ── Factions ────────────────────────────────────────────── */}
      <Section id="factions">
        <SectionHeading
          label={t('landing.factions.label')}
          title={t('landing.factions.title')}
          subtitle={t('landing.factions.subtitle')}
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
                <div className="font-thematic text-blue-400 text-xl uppercase tracking-wider">{t('landing.factions.civil.title')}</div>
              </div>
              <p className="text-white/55 text-sm leading-relaxed mb-5">
                {t('landing.factions.civil.desc')}
              </p>
              <div className="space-y-2">
                <div className="text-xs font-mono uppercase tracking-widest text-white/30 mb-2">{t('landing.factions.win_conditions')}</div>
                <div className="flex items-center gap-2 text-sm text-white/60">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-400/60 shrink-0" />
                  {t('landing.factions.civil.win_1')}
                </div>
                <div className="flex items-center gap-2 text-sm text-white/60">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-400/60 shrink-0" />
                  {t('landing.factions.civil.win_2')}
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
                <div className="font-thematic text-red-400 text-xl uppercase tracking-wider">{t('landing.factions.state.title')}</div>
              </div>
              <p className="text-white/55 text-sm leading-relaxed mb-5">
                {t('landing.factions.state.desc')}
              </p>
              <div className="space-y-2">
                <div className="text-xs font-mono uppercase tracking-widest text-white/30 mb-2">{t('landing.factions.win_conditions')}</div>
                <div className="flex items-center gap-2 text-sm text-white/60">
                  <div className="w-1.5 h-1.5 rounded-full bg-red-400/60 shrink-0" />
                  {t('landing.factions.state.win_1')}
                </div>
                <div className="flex items-center gap-2 text-sm text-white/60">
                  <div className="w-1.5 h-1.5 rounded-full bg-red-400/60 shrink-0" />
                  {t('landing.factions.state.win_2')}
                </div>
              </div>
            </div>
            {/* Overseer note */}
            <div className="mx-6 md:mx-8 mb-6 md:mb-8 -mt-1 rounded-xl bg-red-950/40 border border-red-600/20 p-4">
              <div className="flex items-center gap-2 mb-1">
                <OverseerIcon className="w-4 h-4 text-red-500" />
                <span className="text-red-500 font-bold text-xs uppercase tracking-widest">{t('landing.factions.overseer.title')}</span>
              </div>
              <p className="text-white/40 text-xs leading-relaxed">
                {t('landing.factions.overseer.desc')}
              </p>
            </div>
          </motion.div>
        </div>
      </Section>

      {/* ── Game Loop ───────────────────────────────────────────── */}
      <Section id="how-to-play">
        <SectionHeading
          label={t('landing.loop.label')}
          title={t('landing.loop.title')}
          subtitle={t('landing.loop.subtitle')}
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
          label={t('landing.features.label')}
          title={t('landing.features.title')}
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
              {t('landing.cta.title')}
            </h2>
            <p className="text-white/50 text-base mb-10 max-w-sm mx-auto leading-relaxed">
              {t('landing.cta.subtitle')}
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button
                id="cta-play-now"
                onClick={onPlayNow}
                className="relative overflow-hidden bg-white text-black font-thematic text-lg uppercase tracking-[0.2em] px-10 py-4 rounded-2xl hover:bg-white/90 transition-all duration-300 shadow-[0_0_40px_rgba(255,255,255,0.15)] hover:shadow-[0_0_60px_rgba(255,255,255,0.3)] animate-shine"
              >
                {t('landing.cta.button')}
              </button>
              <button
                id="cta-login"
                onClick={onLogin}
                className="bg-white/5 hover:bg-white/10 border border-white/15 hover:border-white/30 text-white font-thematic text-lg uppercase tracking-[0.2em] px-10 py-4 rounded-2xl transition-all duration-300"
              >
                {t('landing.nav.login')}
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
