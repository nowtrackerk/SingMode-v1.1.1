

import React, { useState } from 'react';
import { RequestType, Participant } from '../types';

interface SongRequestFormProps {
  onSubmit: (data: { singerName?: string, songName: string, artist: string, youtubeUrl?: string, type: RequestType, message?: string, duetPartnerId?: string, duetPartnerName?: string }) => void;
  onCancel: () => void;
  title?: string;
  showSingerName?: boolean;
  initialSingerName?: string;
  initialSongName?: string;
  initialArtist?: string;
  initialYoutubeUrl?: string;
  initialType?: RequestType;
  submitLabel?: string;
  participants?: Participant[];
  currentUserId?: string;
}

const SongRequestForm: React.FC<SongRequestFormProps> = ({
  onSubmit,
  onCancel,
  title = "Song Request",
  showSingerName = false,
  initialSingerName = '',
  initialSongName = '',
  initialArtist = '',
  initialYoutubeUrl = '',
  initialType = RequestType.SINGING,
  submitLabel = "SEND REQUEST",
  participants = [],
  currentUserId = ''
}) => {
  const [singerName, setSingerName] = useState(initialSingerName);
  const displayTitle = singerName ? `${title}: ${singerName}` : title;
  const [songName, setSongName] = useState(initialSongName);
  const [artist, setArtist] = useState(initialArtist);
  const [youtubeUrl, setYoutubeUrl] = useState(initialYoutubeUrl);
  const [type, setType] = useState<RequestType>(initialType);
  const [message, setMessage] = useState('');
  const [duetPartnerId, setDuetPartnerId] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if ((!songName || !artist) && !youtubeUrl) return;
    if (showSingerName && !singerName) return;

    const duetPartner = participants.find(p => p.id === duetPartnerId);
    onSubmit({
      singerName,
      songName,
      artist,
      youtubeUrl,
      type,
      message,
      duetPartnerId: duetPartnerId || undefined,
      duetPartnerName: duetPartner?.name
    });
  };

  return (
    <form onSubmit={handleSubmit} className="relative w-full bg-[#050510] border-4 border-white/10 rounded-[3rem] p-10 overflow-hidden shadow-[0_0_100px_rgba(0,0,0,0.8)] animate-in fade-in zoom-in-95 duration-300">
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[var(--neon-pink)] via-[var(--neon-purple)] to-[var(--neon-cyan)] animate-gradient-x"></div>

      <div className="mb-8 text-center">
        <h3 className="text-3xl font-bold text-white font-bungee uppercase tracking-tight neon-text-glow-purple mb-2">{displayTitle}</h3>
        <p className="text-[10px] text-[var(--neon-cyan)] font-bold uppercase tracking-widest font-righteous opacity-80">NEW REQUEST</p>
      </div>

      <div className="space-y-6">
        {showSingerName && (
          <div className="animate-in fade-in slide-in-from-top-2">
            <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-2 ml-4 font-righteous">Your Name</label>
            <input
              type="text"
              required
              value={singerName}
              onChange={(e) => setSingerName(e.target.value)}
              placeholder="e.g. STAR_VIBE"
              className="w-full bg-[#101015] border-2 border-white/10 rounded-2xl px-6 py-4 text-white font-bold focus:border-[var(--neon-cyan)] outline-none transition-all uppercase shadow-inner text-sm font-righteous tracking-widest"
            />
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-2 ml-4 font-righteous">Song Title</label>
            <input
              type="text"
              value={songName}
              onChange={(e) => setSongName(e.target.value)}
              placeholder="TITLE"
              className="w-full bg-[#101015] border-2 border-white/10 rounded-2xl px-6 py-4 text-white font-bold focus:border-[var(--neon-pink)] outline-none transition-all uppercase shadow-inner text-sm font-righteous tracking-widest"
            />
          </div>
          <div>
            <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-2 ml-4 font-righteous">Artist</label>
            <input
              type="text"
              value={artist}
              onChange={(e) => setArtist(e.target.value)}
              placeholder="ARTIST"
              className="w-full bg-[#101015] border-2 border-white/10 rounded-2xl px-6 py-4 text-white font-bold focus:border-[var(--neon-pink)] outline-none transition-all uppercase shadow-inner text-sm font-righteous tracking-widest"
            />
          </div>
        </div>

        <div>
          <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-2 ml-4 font-righteous">YouTube URL (Optional)</label>
          <input
            type="url"
            value={youtubeUrl}
            onChange={(e) => setYoutubeUrl(e.target.value)}
            placeholder="https://youtube.com/watch?v=..."
            className="w-full bg-[#101015] border-2 border-white/10 rounded-2xl px-6 py-4 text-white font-bold focus:border-[var(--neon-cyan)] outline-none transition-all text-xs font-mono shadow-inner tracking-wider"
          />
        </div>

        <div>
          <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-2 ml-4 font-righteous">Note for DJ</label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Key change? Dedication?"
            rows={2}
            className="w-full bg-[#101015] border-2 border-white/10 rounded-2xl px-6 py-4 text-white font-bold focus:border-[var(--neon-purple)] outline-none transition-all uppercase shadow-inner text-sm font-righteous tracking-widest resize-none"
          />
        </div>

        {type === RequestType.SINGING && participants.length > 1 && (
          <div>
            <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-2 ml-4 font-righteous">Duet Partner (Optional)</label>
            <select
              value={duetPartnerId}
              onChange={(e) => setDuetPartnerId(e.target.value)}
              className="w-full bg-[#101015] border-2 border-white/10 rounded-2xl px-6 py-4 text-white font-bold focus:border-[var(--neon-green)] outline-none transition-all uppercase shadow-inner text-sm font-righteous tracking-widest appearance-none"
            >
              <option value="">-- NO PARTNER --</option>
              {participants
                .filter(p => p.id !== currentUserId)
                .map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))
              }
            </select>
          </div>
        )}

        <div>
          <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-2 ml-4 font-righteous">Performance Mode</label>
          <div className="flex bg-black/40 p-1.5 rounded-2xl border-2 border-white/5">
            {(Object.values(RequestType)).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                className={`flex-1 py-3 rounded-xl font-bold text-[9px] uppercase tracking-widest transition-all font-righteous ${type === t
                  ? 'bg-[var(--neon-cyan)] text-black shadow-[0_0_20px_rgba(0,229,255,0.4)]'
                  : 'text-slate-600 hover:text-white hover:bg-white/5'
                  }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-4 pt-6">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-4 bg-black hover:bg-white/5 text-white rounded-xl font-bold text-[10px] uppercase tracking-widest transition-all border-2 border-white/10 font-righteous"
          >
            DISCARD
          </button>
          <button
            type="submit"
            className="flex-[2] py-4 bg-[var(--neon-pink)] hover:bg-white hover:text-black text-white rounded-xl font-bold text-[10px] uppercase tracking-widest shadow-[0_0_30px_rgba(255,0,127,0.4)] transition-all font-righteous hover:scale-105"
          >
            {submitLabel}
          </button>
        </div>
      </div>
    </form>
  );
};

export default SongRequestForm;
