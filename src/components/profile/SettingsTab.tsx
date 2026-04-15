import React, { useState, useEffect } from 'react';
import { useTranslation } from '../../contexts/I18nContext';
import { LanguageSwitcher } from '../common/LanguageSwitcher';
import { Pencil, Check, X, Clock, Bell } from 'lucide-react';
import { cn, apiUrl } from '../../utils/utils';
import { User } from '../../../shared/types';
import { usePushNotifications } from '../../hooks/usePushNotifications';

interface SettingsTabProps {
  user: User;
  token: string;
  onUpdateUser: (user: User) => void;
  playSound: (soundKey: string) => void;
  settings: any;
}

export function SettingsTab({ user, token, onUpdateUser, playSound, settings }: SettingsTabProps) {
  const { t } = useTranslation();
  const { permission, registerPush, loading: pushLoading } = usePushNotifications(!!token && !!user);
  const [settingsTab, setSettingsTab] = useState<'general' | 'audio' | 'voice'>('general');
  const [isEditingEmail, setIsEditingEmail] = useState(false);
  const [newEmail, setNewEmail] = useState(user.email || '');
  const [isSavingEmail, setIsSavingEmail] = useState(false);
  const [error, setError] = useState('');
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;

    const loadVoices = () => {
      const v = window.speechSynthesis.getVoices();
      if (v.length > 0) {
        setVoices(v);
      }
    };

    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }

    loadVoices();
  }, []);

  const handleUpdateEmail = async () => {
    if (!newEmail || newEmail === user.email) {
      setIsEditingEmail(false);
      return;
    }
    if (!newEmail.includes('@')) {
      setError(t('common.error_invalid_email'));
      return;
    }
    setIsSavingEmail(true);
    setError('');
    try {
      const res = await fetch(apiUrl('/api/user/update-email'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ email: newEmail }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Update failed');

      onUpdateUser(data.user);
      setIsEditingEmail(false);
      playSound('election_passed');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSavingEmail(false);
    }
  };

  const {
    isLightMode,
    setIsLightMode,
    isFullscreen,
    setIsFullscreen,
    uiScaleSetting,
    setUiScaleSetting,
    isMusicOn,
    setIsMusicOn,
    musicVolume,
    setMusicVolume,
    isSoundOn,
    setIsSoundOn,
    soundVolume,
    setSoundVolume,
    isAiVoiceEnabled,
    setIsAiVoiceEnabled,
    ttsVoice,
    setTtsVoice,
    ttsVolume,
    setTtsVolume,
  } = settings;

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
      setIsFullscreen(false);
    }
  };

  return (
    <div className="space-y-6 max-w-lg mx-auto">
      {error && (
        <div className="text-red-500 text-xs text-center font-mono bg-red-900/10 py-3 rounded-xl border border-red-900/20">
          {error}
        </div>
      )}

      {/* Settings Sub-tabs */}
      <div className="flex gap-1 p-1 bg-elevated rounded-2xl border border-subtle mb-6">
        {[
          { id: 'general', label: t('profile.settings.tabs.general') },
          { id: 'audio', label: t('profile.settings.tabs.audio') },
          { id: 'voice', label: t('profile.settings.tabs.voice') },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => {
              playSound('click');
              setSettingsTab(tab.id as any);
            }}
            className={cn(
              'flex-1 px-4 py-2 rounded-xl text-[10px] font-mono uppercase tracking-widest transition-all',
              settingsTab === tab.id
                ? 'bg-red-900 text-white shadow-lg'
                : 'text-ghost hover:text-muted'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="space-y-4">
        {settingsTab === 'general' && (
          <>
            <div className="flex items-center justify-between p-4 bg-elevated border border-subtle rounded-2xl overflow-visible">
              <div>
                <span className="text-sm font-mono text-primary">{t('profile.settings.general.language')}</span>
                <p className="text-[10px] font-mono text-muted uppercase mt-0.5">
                  {t('profile.settings.general.language_desc')}
                </p>
              </div>
              <LanguageSwitcher variant="solid" />
            </div>

            <div className="flex items-center justify-between p-4 bg-elevated border border-subtle rounded-2xl">
              <div>
                <span className="text-sm font-mono text-primary flex items-center gap-2">
                  <Bell className="w-4 h-4" />
                  {t('profile.settings.general.push_notifications')}
                </span>
                <p className="text-[10px] font-mono text-muted uppercase mt-0.5">
                  {permission === 'granted' 
                    ? t('profile.settings.general.push_notifications_enabled') 
                    : permission === 'denied' 
                    ? t('profile.settings.general.push_notifications_blocked')
                    : t('profile.settings.general.push_notifications_desc')}
                </p>
              </div>
              <button
                onClick={() => {
                  playSound('click');
                  if (permission !== 'granted') registerPush();
                }}
                disabled={pushLoading || permission === 'denied'}
                className={cn(
                  'w-12 h-6 rounded-full transition-all relative shrink-0',
                  permission === 'granted' ? 'bg-red-900' : 'bg-subtle',
                  (pushLoading || permission === 'denied') && 'opacity-50 cursor-not-allowed'
                )}
              >
                <div
                  className={cn(
                    'absolute top-1 w-4 h-4 rounded-full bg-white transition-all',
                    permission === 'granted' ? 'left-7' : 'left-1'
                  )}
                />
              </button>
            </div>

            <div className="flex items-center justify-between p-4 bg-elevated border border-subtle rounded-2xl">
              <div>
                <span className="text-sm font-mono text-primary">{t('profile.settings.general.light_mode')}</span>
                <p className="text-[10px] font-mono text-muted uppercase mt-0.5">
                  {t('profile.settings.general.light_mode_desc')}
                </p>
              </div>
              <button
                onClick={() => setIsLightMode(!isLightMode)}
                className={cn(
                  'w-12 h-6 rounded-full transition-all relative shrink-0',
                  isLightMode ? 'bg-yellow-500' : 'bg-subtle'
                )}
              >
                <div
                  className={cn(
                    'absolute top-1 w-4 h-4 rounded-full bg-white transition-all',
                    isLightMode ? 'left-7' : 'left-1'
                  )}
                />
              </button>
            </div>
            <div className="flex items-center justify-between p-4 bg-elevated border border-subtle rounded-2xl">
              <span className="text-sm font-mono text-primary">{t('profile.settings.general.fullscreen')}</span>
              <button
                onClick={toggleFullscreen}
                className={cn(
                  'w-12 h-6 rounded-full transition-all relative',
                  isFullscreen ? 'bg-red-900' : 'bg-subtle'
                )}
              >
                <div
                  className={cn(
                    'absolute top-1 w-4 h-4 rounded-full bg-white transition-all',
                    isFullscreen ? 'left-7' : 'left-1'
                  )}
                />
              </button>
            </div>
            <div className="p-4 bg-elevated border border-subtle rounded-2xl space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm font-mono text-primary">{t('profile.settings.general.ui_scale')}</span>
                <span className="text-xs font-mono text-muted">
                  {Math.round(uiScaleSetting * 100)}%
                </span>
              </div>
              <input
                type="range"
                min="0.5"
                max="1.5"
                step="0.05"
                value={uiScaleSetting}
                onChange={(e) => setUiScaleSetting(parseFloat(e.target.value))}
                className="w-full accent-red-900"
              />
              <p className="text-[10px] font-mono text-ghost uppercase">
                {t('profile.settings.general.ui_scale_desc')}
              </p>
            </div>
            <div className="p-4 bg-elevated border border-subtle rounded-2xl space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-sm font-mono text-primary">{t('profile.settings.general.recovery_email')}</span>
                  <p className="text-[10px] font-mono text-muted uppercase mt-0.5">
                    {t('profile.settings.general.recovery_email_desc')}
                  </p>
                </div>
                {!isEditingEmail && (
                  <button
                    onClick={() => {
                      playSound('click');
                      setIsEditingEmail(true);
                    }}
                    className="p-1.5 rounded-lg bg-white/5 border border-default text-ghost hover:text-primary transition-all"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {isEditingEmail ? (
                <div className="flex items-center gap-2 animate-in fade-in slide-in-from-top-1">
                  <input
                    autoFocus
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder={t('profile.settings.general.recovery_email_placeholder')}
                    onKeyDown={(e) => e.key === 'Enter' && handleUpdateEmail()}
                    className="flex-1 bg-card border border-primary text-primary px-3 py-1.5 rounded-lg text-sm font-mono focus:outline-none"
                    disabled={isSavingEmail}
                  />
                  <button
                    onClick={handleUpdateEmail}
                    disabled={isSavingEmail}
                    className="p-2 rounded-lg bg-emerald-900/20 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-900/40"
                  >
                    {isSavingEmail ? (
                      <Clock className="w-4 h-4 animate-spin" />
                    ) : (
                      <Check className="w-4 h-4" />
                    )}
                  </button>
                  <button
                    onClick={() => {
                      setIsEditingEmail(false);
                      setNewEmail(user.email || '');
                    }}
                    className="p-2 rounded-lg bg-red-900/20 border border-red-500/30 text-red-500 hover:bg-red-900/40"
                    disabled={isSavingEmail}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="bg-card border border-default px-3 py-2 rounded-xl">
                  <span
                    className={cn(
                      'text-xs font-mono',
                      user.email ? 'text-primary' : 'text-red-400 italic'
                    )}
                  >
                    {user.email || t('profile.settings.general.no_recovery_email')}
                  </span>
                </div>
              )}
            </div>
          </>
        )}

        {settingsTab === 'audio' && (
          <>
            <div className="flex items-center justify-between p-4 bg-elevated border border-subtle rounded-2xl">
              <span className="text-sm font-mono text-primary">{t('profile.settings.audio.music')}</span>
              <button
                onClick={() => setIsMusicOn(!isMusicOn)}
                className={cn(
                  'w-12 h-6 rounded-full transition-all relative',
                  isMusicOn ? 'bg-red-900' : 'bg-subtle'
                )}
              >
                <div
                  className={cn(
                    'absolute top-1 w-4 h-4 rounded-full bg-white transition-all',
                    isMusicOn ? 'left-7' : 'left-1'
                  )}
                />
              </button>
            </div>
            <div className="p-4 bg-elevated border border-subtle rounded-2xl space-y-2">
              <span className="text-sm font-mono text-primary">{t('profile.settings.audio.music_volume')}</span>
              <input
                type="range"
                min="0"
                max="100"
                value={musicVolume}
                onChange={(e) => setMusicVolume(parseInt(e.target.value))}
                className="w-full accent-red-900"
              />
            </div>
            <div className="flex items-center justify-between p-4 bg-elevated border border-subtle rounded-2xl">
              <span className="text-sm font-mono text-primary">{t('profile.settings.audio.sfx')}</span>
              <button
                onClick={() => setIsSoundOn(!isSoundOn)}
                className={cn(
                  'w-12 h-6 rounded-full transition-all relative',
                  isSoundOn ? 'bg-red-900' : 'bg-subtle'
                )}
              >
                <div
                  className={cn(
                    'absolute top-1 w-4 h-4 rounded-full bg-white transition-all',
                    isSoundOn ? 'left-7' : 'left-1'
                  )}
                />
              </button>
            </div>
            <div className="p-4 bg-elevated border border-subtle rounded-2xl space-y-2">
              <span className="text-sm font-mono text-primary">{t('profile.settings.audio.sfx_volume')}</span>
              <input
                type="range"
                min="0"
                max="100"
                value={soundVolume}
                onChange={(e) => setSoundVolume(parseInt(e.target.value))}
                className="w-full accent-red-900"
              />
            </div>
          </>
        )}

        {settingsTab === 'voice' && (
          <>
            <div className="flex items-center justify-between p-4 bg-elevated border border-subtle rounded-2xl">
              <span className="text-sm font-mono text-primary">{t('profile.settings.voice.ai_voice')}</span>
              <button
                onClick={() => setIsAiVoiceEnabled(!isAiVoiceEnabled)}
                className={cn(
                  'w-12 h-6 rounded-full transition-all relative',
                  isAiVoiceEnabled ? 'bg-emerald-900' : 'bg-subtle'
                )}
              >
                <div
                  className={cn(
                    'absolute top-1 w-4 h-4 rounded-full bg-white transition-all',
                    isAiVoiceEnabled ? 'left-7' : 'left-1'
                  )}
                />
              </button>
            </div>

            <div className="p-4 bg-elevated border border-subtle rounded-2xl space-y-2">
              <span className="text-sm font-mono text-primary">{t('profile.settings.voice.tts_voice')}</span>
              <select
                value={ttsVoice}
                onChange={(e) => setTtsVoice(e.target.value)}
                className="w-full bg-card text-primary p-2 rounded-xl text-sm font-mono border border-default"
              >
                <option value="">{t('profile.settings.voice.tts_default')}</option>
                {voices.map((v) => (
                  <option key={v.name} value={v.name}>
                    {v.name} ({v.lang})
                  </option>
                ))}
              </select>
            </div>

            <div className="p-4 bg-elevated border border-subtle rounded-2xl space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm font-mono text-primary">{t('profile.settings.voice.narrator_volume')}</span>
                <span className="text-xs font-mono text-muted">{ttsVolume}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={ttsVolume}
                onChange={(e) => setTtsVolume(parseInt(e.target.value))}
                className="w-full accent-emerald-900"
              />
              <p className="text-[10px] font-mono text-ghost uppercase mt-1">
                {t('profile.settings.voice.narrator_volume_desc')}
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}


