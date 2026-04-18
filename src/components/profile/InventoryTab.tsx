import React, { useState } from 'react';
import { useTranslation } from '../../contexts/I18nContext';
import { cn, getProxiedUrl, apiUrl } from '../../utils/utils';
import { CosmeticItem, User } from '../../../shared/types';
import { Play, Pause, User as UserIcon, Scroll } from 'lucide-react';
import { getPolicyStyles, getVoteStyles, getFrameStyles, getRarity } from '../../utils/cosmetics';
import { DEFAULT_ITEMS } from '../../sharedConstants';
import { getLevelFromXp } from '../../utils/xp';

interface InventoryProps {
  user: User;
  onUpdateUser: (user: User) => void;
  token: string;
  playSound: (soundKey: string) => void;
  playPreview: (item: CosmeticItem) => void;
  playingItemId: string | null;
}

export const InventoryTab: React.FC<InventoryProps> = ({
  user,
  onUpdateUser,
  token,
  playSound,
  playPreview,
  playingItemId,
}) => {
  const { t } = useTranslation();
  const [category, setCategory] = useState<
    'frame' | 'badge' | 'policy' | 'vote' | 'music' | 'sound' | 'background'
  >('frame');

  const handleEquip = async (
    type: 'frame' | 'badge' | 'policy' | 'vote' | 'music' | 'sound' | 'background',
    itemId: string | undefined
  ) => {
    try {
      const body: Record<string, string> = {};
      if (type === 'frame') body.frameId = itemId ?? '';
      else if (type === 'policy') body.policyStyle = itemId ?? '';
      else if (type === 'vote') body.votingStyle = itemId ?? '';
      else if (type === 'music') body.music = itemId ?? '';
      else if (type === 'sound') body.soundPack = itemId ?? '';
      else if (type === 'background') body.backgroundId = itemId ?? '';

      const res = await fetch(apiUrl('/api/profile/frame'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const data = await res.json();
        onUpdateUser(data.user);
      }
    } catch {
      // Ignored for UI
    }
  };

  const typeItems = DEFAULT_ITEMS.filter((item) => {
    if (item.type !== category) return false;

    // Always show defaults
    if (item.id.endsWith('-default')) return true;

    // Show owned or unlocked items
    const isPassItem = item.id.includes('-pass-');
    return isPassItem 
      ? user.claimedRewards?.some(r => r.includes(item.id)) || false
      : user.ownedCosmetics?.includes(item.id);
  });

  const categories: {
    id: 'frame' | 'badge' | 'policy' | 'vote' | 'music' | 'sound' | 'background';
    label: string;
  }[] = [
    { id: 'frame', label: t('profile.inventory.categories.frame') },
    { id: 'policy', label: t('profile.inventory.categories.policy') },
    { id: 'vote', label: t('profile.inventory.categories.vote') },
    { id: 'music', label: t('profile.inventory.categories.music') },
    { id: 'sound', label: t('profile.inventory.categories.sound') },
    { id: 'background', label: t('profile.inventory.categories.background') },
  ];

  return (
    <div className="space-y-8">
      {/* Categories */}
      <div className="flex flex-col gap-2 w-full max-w-lg mx-auto mb-8">
        {/* Row 1 */}
        <div className="flex gap-1 sm:gap-2 p-1 bg-elevated rounded-2xl border border-subtle">
          {categories.slice(0, 3).map((cat) => (
            <button
              key={cat.id}
              onClick={() => {
                playSound('click');
                setCategory(cat.id);
              }}
              className={cn(
                'flex-1 px-3 sm:px-6 py-2 rounded-xl text-[9px] sm:text-[10px] font-mono uppercase tracking-widest transition-all whitespace-nowrap',
                category === cat.id ? 'bg-red-900 text-white' : 'text-ghost hover:text-muted'
              )}
            >
              {cat.label}
            </button>
          ))}
        </div>
        {/* Row 2 */}
        <div className="flex gap-1 sm:gap-2 p-1 bg-elevated rounded-2xl border border-subtle">
          {categories.slice(3, 6).map((cat) => (
            <button
              key={cat.id}
              onClick={() => {
                playSound('click');
                setCategory(cat.id);
              }}
              className={cn(
                'flex-1 px-3 sm:px-6 py-2 rounded-xl text-[9px] sm:text-[10px] font-mono uppercase tracking-widest transition-all whitespace-nowrap',
                category === cat.id ? 'bg-red-900 text-white' : 'text-ghost hover:text-muted'
              )}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {typeItems.map((item) => {
          const isEquipped =
            (item.type === 'frame' &&
              (user.activeFrame === item.id ||
                (!user.activeFrame && item.id === 'frame-default'))) ||
            (item.type === 'policy' &&
              (user.activePolicyStyle === item.id ||
                (!user.activePolicyStyle && item.id === 'policy-default'))) ||
            (item.type === 'vote' &&
              (user.activeVotingStyle === item.id ||
                (!user.activeVotingStyle && item.id === 'vote-default'))) ||
            (item.type === 'music' &&
              (user.activeMusic === item.id ||
                (!user.activeMusic && item.id === 'music-default'))) ||
            (item.type === 'sound' &&
              (user.activeSoundPack === item.id ||
                (!user.activeSoundPack && item.id === 'sound-default'))) ||
            (item.type === 'background' &&
              (user.activeBackground === item.id ||
                (!user.activeBackground && item.id === 'background-default')));

          return (
            <div
              key={item.id}
              className="bg-elevated border border-subtle rounded-3xl p-6 flex flex-col items-center text-center"
            >
              <div className="relative w-20 h-20 rounded-2xl bg-card border border-default mb-4 flex items-center justify-center">
                {item.type === 'music' ? (
                  <button
                    onClick={() => playPreview(item)}
                    className="w-full h-full flex items-center justify-center"
                  >
                    {playingItemId === item.id ? (
                      <Pause className="w-8 h-8 text-primary" />
                    ) : (
                      <Play className="w-8 h-8 text-primary" />
                    )}
                  </button>
                ) : item.type === 'frame' ? (
                  <>
                    {user.avatarUrl ? (
                      <img
                        src={getProxiedUrl(user.avatarUrl)}
                        alt={user.username}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <UserIcon className="w-10 h-10 text-ghost" />
                    )}
                    <div
                      className={cn(
                        'absolute inset-0 border-4 rounded-2xl pointer-events-none',
                        getFrameStyles(item.id)
                      )}
                    />
                  </>
                ) : item.type === 'policy' ? (
                  <div
                    className={cn(
                      'w-full h-full flex flex-col items-center justify-center gap-1',
                      getPolicyStyles(item.id, 'Civil')
                    )}
                  >
                    <Scroll className="w-8 h-8" />
                  </div>
                ) : item.type === 'vote' ? (
                  <div
                    className={cn(
                      'w-full h-full flex flex-col items-center justify-center gap-1',
                      getVoteStyles(item.id, 'Aye')
                    )}
                  >
                    <span className="text-lg font-thematic uppercase">{t('profile.inventory.vote_aye')}</span>
                    <span className="text-[8px] font-mono uppercase">{t('profile.inventory.vote_yes')}</span>
                  </div>
                ) : item.id === 'bg-nebula-void' ? (
                  <div className="w-full h-full rounded-2xl bg-nebula-void overflow-hidden scale-[0.25] origin-center" />
                ) : item.imageUrl ? (
                  <img
                    src={getProxiedUrl(item.imageUrl)}
                    alt={item.name}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="text-[8px] font-mono uppercase">{item.type}</div>
                )}
              </div>
              <h4 className="font-serif italic text-lg mb-1 text-primary">{item.name}</h4>
              <p className="text-[10px] text-muted font-mono uppercase mb-1">
                {item.type === 'policy' ? t('profile.inventory.item_type_policy') : t(`profile.inventory.categories.${item.type}`)}
              </p>
              <p className={cn('text-[9px] font-mono uppercase mb-4', getRarity(item.price).color)}>
                {t(`profile.inventory.rarities.${getRarity(item.price).name.toLowerCase()}`)}
              </p>
              <button
                onClick={() => {
                  playSound('click');
                  handleEquip(item.type as any, item.id.endsWith('-default') ? undefined : item.id);
                }}
                disabled={isEquipped}
                className={cn(
                  'w-full py-2 rounded-xl text-[10px] font-mono uppercase tracking-widest transition-all',
                  isEquipped
                    ? 'bg-emerald-900/20 text-emerald-500 border border-emerald-900/50'
                    : 'bg-card text-white hover:bg-subtle'
                )}
              >
                {isEquipped ? t('profile.inventory.btn_equipped') : t('profile.inventory.btn_equip')}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};


