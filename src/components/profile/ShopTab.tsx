import React, { useState } from 'react';
import { useTranslation } from '../../contexts/I18nContext';
import { User, CosmeticItem } from '../../../shared/types';
import { DEFAULT_ITEMS } from '../../sharedConstants';
import { Coins, User as UserIcon, Scroll, Pause, Play } from 'lucide-react';
import { cn, getProxiedUrl, apiUrl } from '../../utils/utils';
import { getPolicyStyles, getVoteStyles, getFrameStyles, getRarity } from '../../utils/cosmetics';

interface ShopTabProps {
  user: User;
  token: string;
  onUpdateUser: (user: User) => void;
  playSound: (soundKey: string) => void;
  playPreview: (item: CosmeticItem) => void;
  playingItemId: string | null;
}

export function ShopTab({ user, token, onUpdateUser, playSound, playPreview, playingItemId }: ShopTabProps) {
  const { t } = useTranslation();
  const [shopCategory, setShopCategory] = useState<
    'frame' | 'policy' | 'vote' | 'music' | 'sound' | 'background'
  >('frame');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleBuy = async (item: CosmeticItem) => {
    setIsLoading(true);
    setError('');
    try {
      const response = await fetch(apiUrl('/api/shop/buy'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ itemId: item.id, price: item.price }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      onUpdateUser(data.user);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredItems = DEFAULT_ITEMS.filter(
    (item) =>
      item.type === shopCategory && !item.id.includes('-pass-') && !item.id.endsWith('-default')
  );

  return (
    <div className="space-y-8">
      {error && (
        <div className="text-red-500 text-xs text-center font-mono bg-red-900/10 py-3 rounded-xl border border-red-900/20">
          {error}
        </div>
      )}

      {/* Shop Categories */}
      <div className="flex flex-col gap-2 w-full max-w-lg mx-auto mb-8">
        {/* Row 1 */}
        <div className="flex gap-1 sm:gap-2 p-1 bg-elevated rounded-2xl border border-subtle">
          {[
            { id: 'frame', label: t('profile.inventory.categories.frame') },
            { id: 'policy', label: t('profile.inventory.categories.policy') },
            { id: 'vote', label: t('profile.inventory.categories.vote') },
          ].map((cat) => (
            <button
              key={cat.id}
              onClick={() => {
                playSound('click');
                setShopCategory(cat.id as any);
              }}
              className={cn(
                'flex-1 px-3 sm:px-6 py-2 rounded-xl text-[9px] sm:text-[10px] font-mono uppercase tracking-widest transition-all whitespace-nowrap',
                shopCategory === cat.id
                  ? 'bg-red-900 text-white'
                  : 'text-ghost hover:text-muted'
              )}
            >
              {cat.label}
            </button>
          ))}
        </div>
        {/* Row 2 */}
        <div className="flex gap-1 sm:gap-2 p-1 bg-elevated rounded-2xl border border-subtle">
          {[
            { id: 'music', label: t('profile.inventory.categories.music') },
            { id: 'sound', label: t('profile.inventory.categories.sound') },
            { id: 'background', label: t('profile.inventory.categories.background') },
          ].map((cat) => (
            <button
              key={cat.id}
              onClick={() => {
                playSound('click');
                setShopCategory(cat.id as any);
              }}
              className={cn(
                'flex-1 px-3 sm:px-6 py-2 rounded-xl text-[9px] sm:text-[10px] font-mono uppercase tracking-widest transition-all whitespace-nowrap',
                shopCategory === cat.id
                  ? 'bg-red-900 text-white'
                  : 'text-ghost hover:text-muted'
              )}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredItems.map((item) => {
          const isOwned = user.ownedCosmetics.includes(item.id);

          return (
            <div
              key={item.id}
              className="bg-elevated border border-subtle rounded-3xl p-6 flex flex-col items-center text-center group"
            >
              <div className="relative w-20 h-20 mb-4">
                <div className="w-20 h-20 rounded-2xl bg-card border border-default flex items-center justify-center">
                  {item.type === 'frame' ? (
                    user.avatarUrl ? (
                      <img
                        src={getProxiedUrl(user.avatarUrl)}
                        alt={user.username}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <UserIcon className="w-10 h-10 text-ghost" />
                    )
                  ) : item.type === 'music' || item.type === 'sound' ? (
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
                  ) : item.type === 'policy' ? (
                    <div
                      className={cn(
                        'w-full h-full flex flex-col items-center justify-center gap-1',
                        getPolicyStyles(item.id, 'Civil')
                      )}
                    >
                      <Scroll className="w-8 h-8" />
                      <span className="text-[8px] font-mono uppercase">Civil</span>
                    </div>
                  ) : item.type === 'vote' ? (
                    <div
                      className={cn(
                        'w-full h-full flex flex-col items-center justify-center gap-1',
                        getVoteStyles(item.id, 'Aye')
                      )}
                    >
                      <span className="text-lg font-thematic uppercase">AYE!</span>
                      <span className="text-[8px] font-mono uppercase">YES</span>
                    </div>
                  ) : item.type === 'background' ? (
                    <div className="w-full h-full bg-elevated flex items-center justify-center overflow-hidden">
                      {item.id === 'bg-nebula-void' ? (
                        <div className="w-full h-full bg-nebula-void scale-[0.25] origin-center opacity-50" />
                      ) : (
                        <div
                          className="w-full h-full opacity-50"
                          style={{
                            backgroundImage: `url("${getProxiedUrl(item.imageUrl!)}")`,
                            backgroundSize: 'cover',
                          }}
                        />
                      )}
                    </div>
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center gap-1">
                      <span className="text-[8px] font-mono uppercase">{item.type}</span>
                    </div>
                  )}
                </div>
                {item.type === 'frame' && (
                  <div
                    className={cn(
                      'absolute inset-0 border-4 rounded-2xl pointer-events-none',
                      getFrameStyles(item.id)
                    )}
                  />
                )}
              </div>
              <h4 className="font-serif italic text-lg mb-1 text-primary">{item.name}</h4>
              <p className="text-[10px] text-muted font-mono uppercase mb-1">
                {item.type === 'policy' ? t('profile.shop.item_type_policy') : t('profile.shop.item_style', { type: t(`profile.inventory.categories.${item.type}`) })}
              </p>
              <p
                className={cn(
                  'text-[9px] font-mono uppercase mb-2',
                  getRarity(item.price).color
                )}
              >
                {t(`profile.inventory.rarities.${getRarity(item.price).name.toLowerCase()}`)}
              </p>
              <p className="text-[10px] text-ghost font-sans mb-4 line-clamp-2">
                {item.description}
              </p>

              {isOwned ? (
                <button
                  disabled
                  className="w-full py-2 bg-card text-muted rounded-xl text-[10px] font-mono uppercase tracking-widest border border-default cursor-not-allowed"
                >
                  {t('profile.shop.btn_owned')}
                </button>
              ) : item.price === 0 ? (
                <button
                  disabled
                  className="w-full py-2 bg-card text-muted rounded-xl text-[10px] font-mono uppercase tracking-widest border border-default cursor-not-allowed"
                >
                  {t('profile.shop.btn_locked_pass')}
                </button>
              ) : (
                <button
                  onClick={() => {
                    playSound('click');
                    handleBuy(item);
                  }}
                  disabled={user.stats.points < item.price || isLoading}
                  className="w-full py-2 bg-red-900 text-white rounded-xl text-[10px] font-thematic uppercase tracking-widest hover:bg-red-800 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <Coins className="w-3 h-3" />
                  {t('profile.shop.btn_buy_pts', { price: item.price })}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}


