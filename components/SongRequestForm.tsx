

import React, { useState } from 'react';
import { RequestType } from '../types';

interface SongRequestFormProps {
  onSubmit: (data: { singerName?: string, songName: string, artist: string, youtubeUrl?: string, type: RequestType }) => void;
  onCancel: () => void;
  title?: string;
  showSingerName?: boolean;
  initialSingerName?: string;
  initialSongName?: string;
  initialArtist?: string;
  initialYoutubeUrl?: string;
  initialType?: RequestType;
  submitLabel?: string;
}

const SongRequestForm: React.FC<SongRequestFormProps> = ({
  onSubmit,
  onCancel,
  title = "Global Track Input",
  showSingerName = false,
  initialSingerName = '',
  initialSongName = '',
  initialArtist = '',
  initialYoutubeUrl = '',
  initialType = RequestType.SINGING,
  submitLabel = "Process Request"
}) => {
  const displayTitle = singerName ? `${title}: ${singerName}` : title;
  const [singerName, setSingerName] = useState(initialSingerName);
  const [songName, setSongName] = useState(initialSongName);
  const [artist, setArtist] = useState(initialArtist);
  const [youtubeUrl, setYoutubeUrl] = useState(initialYoutubeUrl);
  const [type, setType] = useState<RequestType>(initialType);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if ((!songName || !artist) && !youtubeUrl) return;
    if (showSingerName && !singerName) return;
    onSubmit({ singerName, songName, artist, youtubeUrl, type });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 bg-slate-900 p-10 rounded-3xl shadow-3xl border border-white/5 animate-in fade-in zoom-in-95 duration-300">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h3 className="text-3xl font-black text-white font-outfit uppercase tracking-tighter leading-none">{displayTitle}</h3>
          <p className="text-[9px] text-slate-500 font-bold uppercase tracking-[0.3em] mt-2">SingMode Operations</p>
        </div>
      </div>

      {showSingerName && (
        <div className="animate-in fade-in slide-in-from-top-2">
          <label className="block text-[10px] font-black text-slate-600 uppercase tracking-widest mb-3 ml-2">Performer Alias as a user in the directory</label>
          <input
            type="text"
            required
            value={singerName}
            onChange={(e) => setSingerName(e.target.value)}
            placeholder="Handle"
            className="w-full bg-slate-950 border border-teal-400/20 rounded-2xl px-6 py-4 text-white font-bold focus:border-teal-400 outline-none transition-all uppercase"
          />
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-[10px] font-black text-slate-600 uppercase tracking-widest mb-3 ml-2">Track Title</label>
          <input
            type="text"
            value={songName}
            onChange={(e) => setSongName(e.target.value)}
            placeholder="Title"
            className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-6 py-4 text-white font-bold focus:border-teal-400 outline-none transition-all uppercase"
          />
        </div>
        <div>
          <label className="block text-[10px] font-black text-slate-600 uppercase tracking-widest mb-3 ml-2">Artist</label>
          <input
            type="text"
            value={artist}
            onChange={(e) => setArtist(e.target.value)}
            placeholder="Artist"
            className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-6 py-4 text-white font-bold focus:border-teal-400 outline-none transition-all uppercase"
          />
        </div>
      </div>

      <div className="relative pt-2">
        <label className="block text-[10px] font-black text-slate-600 uppercase tracking-widest mb-3 ml-2">Source URL (Override)</label>
        <input
          type="url"
          value={youtubeUrl}
          onChange={(e) => setYoutubeUrl(e.target.value)}
          placeholder="https://youtube.com/watch?v=..."
          className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-6 py-4 text-white font-bold focus:border-teal-400 outline-none transition-all text-xs"
        />
      </div>

      <div>
        <label className="block text-[10px] font-black text-slate-600 uppercase tracking-widest mb-3 ml-2">Mode</label>
        <div className="flex bg-slate-950 p-1.5 rounded-2xl border border-slate-800">
          {(Object.values(RequestType)).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setType(t)}
              className={`flex-1 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${type === t
                ? 'bg-teal-400 text-slate-950 shadow-2xl shadow-teal-900/40'
                : 'text-slate-600 hover:text-slate-300'
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
          className="flex-1 py-5 bg-slate-800 hover:bg-slate-700 text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="flex-[2] py-5 bg-teal-400 hover:bg-teal-300 text-slate-950 rounded-2xl font-black text-xs uppercase tracking-widest shadow-3xl shadow-teal-900/30 transition-all active:scale-95"
        >
          {submitLabel}
        </button>
      </div>
    </form>
  );
};

export default SongRequestForm;
