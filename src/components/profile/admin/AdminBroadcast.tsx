import React, { useState } from 'react';
import { useTranslation } from '../../../contexts/I18nContext';
import { Megaphone } from 'lucide-react';
import { socket } from '../../../socket';

export const AdminBroadcast: React.FC = () => {
  const { t } = useTranslation();
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [isBroadcasting, setIsBroadcasting] = useState(false);

  const handleBroadcast = () => {
    if (!broadcastMessage.trim()) return;
    setIsBroadcasting(true);
    socket.emit('adminBroadcast', broadcastMessage);
    setBroadcastMessage('');
    setTimeout(() => setIsBroadcasting(false), 2000);
  };

  return (
    <section className="bg-yellow-500/5 border border-yellow-500/20 rounded-3xl p-6 relative overflow-hidden">
      <div className="flex items-center gap-3 mb-4">
        <Megaphone className="w-5 h-5 text-yellow-500" />
        <h3 className="text-xs font-mono text-primary uppercase tracking-widest font-bold">
          {t('profile.admin.broadcast.title')}
        </h3>
      </div>
      <div className="flex gap-3">
        <input
          type="text"
          value={broadcastMessage}
          onChange={(e) => setBroadcastMessage(e.target.value)}
          placeholder={t('profile.admin.broadcast.placeholder')}
          className="flex-1 bg-white border border-subtle rounded-2xl px-4 py-3 text-sm font-mono text-black placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-yellow-500/50"
        />
        <button
          onClick={handleBroadcast}
          disabled={isBroadcasting || !broadcastMessage.trim()}
          className="btn-primary bg-yellow-600 border-yellow-500 text-black px-8 rounded-2xl font-thematic uppercase tracking-widest text-xs"
        >
          {isBroadcasting ? t('common.sent') : t('profile.admin.broadcast.btn_send')}
        </button>
      </div>
    </section>
  );
};


