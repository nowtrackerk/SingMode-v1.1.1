

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
  suggestions?: { songName: string, artist: string, youtubeUrl?: string }[];
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
  currentUserId = '',
  suggestions = []
}) => {
  const [singerName, setSingerName] = useState(initialSingerName);
  const displayTitle = singerName ? `${title}: ${singerName}` : title;
  const [songName, setSongName] = useState(initialSongName);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [artist, setArtist] = useState(initialArtist);
  const [youtubeUrl, setYoutubeUrl] = useState(initialYoutubeUrl);
  const [type, setType] = useState<RequestType>(initialType);
  const [message, setMessage] = useState('');
  const [duetPartnerId, setDuetPartnerId] = useState('');

  const [filterType, setFilterType] = useState<'ALL' | 'SONG' | 'ARTIST'>('ALL');
  const [duetOnly, setDuetOnly] = useState(false);

  const [showYoutubeSearch, setShowYoutubeSearch] = useState(false);
  const [youtubeSearchQuery, setYoutubeSearchQuery] = useState('');
  const [youtubeResults, setYoutubeResults] = useState<{ id: string, title: string, thumbnail: string }[]>([]);
  const [isSearchingYoutube, setIsSearchingYoutube] = useState(false);

  const handleYoutubeSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!youtubeSearchQuery.trim()) return;
    const apiKey = import.meta.env.VITE_YOUTUBE_API_KEY;
    if (!apiKey) {
      alert("YouTube API Key is missing. Please configure VITE_YOUTUBE_API_KEY in your .env file.");
      return;
    }

    setIsSearchingYoutube(true);
    try {
      const res = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(youtubeSearchQuery + ' karaoke')}&type=video&key=${apiKey}&maxResults=5`);
      const data = await res.json();
      if (data.items) {
        setYoutubeResults(data.items.map((item: any) => ({
          id: item.id.videoId,
          title: item.snippet.title,
          thumbnail: item.snippet.thumbnails.default.url
        })));
      }
    } catch (err) {
      console.error(err);
      alert("Failed to search YouTube");
    } finally {
      setIsSearchingYoutube(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if ((!songName || !artist) && !youtubeUrl) return;
    if (showSingerName && !singerName) return;

    const duetPartner = participants.find(p => p.id === duetPartnerId);
    console.log('[SongRequestForm] Submitting request:', { singerName, songName, artist, type });
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

        <div className="bg-white/5 p-4 rounded-2xl border border-white/10 space-y-3">
          <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-widest font-righteous flex items-center gap-2">
            <span>🎛️</span> Library Filter Settings
          </label>
          <div className="flex flex-wrap gap-2 text-xs">
            <button type="button" onClick={() => setFilterType('ALL')} className={`px-4 py-2 rounded-xl font-bold font-righteous uppercase transition-all tracking-widest ${filterType === 'ALL' ? 'bg-[var(--neon-pink)] text-white shadow-[0_0_15px_rgba(255,0,127,0.4)]' : 'bg-black/50 text-slate-400 hover:text-white hover:bg-white/5'}`}>All</button>
            <button type="button" onClick={() => setFilterType('SONG')} className={`px-4 py-2 rounded-xl font-bold font-righteous uppercase transition-all tracking-widest ${filterType === 'SONG' ? 'bg-[var(--neon-pink)] text-white shadow-[0_0_15px_rgba(255,0,127,0.4)]' : 'bg-black/50 text-slate-400 hover:text-white hover:bg-white/5'}`}>Title</button>
            <button type="button" onClick={() => setFilterType('ARTIST')} className={`px-4 py-2 rounded-xl font-bold font-righteous uppercase transition-all tracking-widest ${filterType === 'ARTIST' ? 'bg-[var(--neon-pink)] text-white shadow-[0_0_15px_rgba(255,0,127,0.4)]' : 'bg-black/50 text-slate-400 hover:text-white hover:bg-white/5'}`}>Artist</button>

            <div className="flex-1 min-w-[20px]"></div>
            <button type="button" onClick={() => setDuetOnly(!duetOnly)} className={`px-4 py-2 rounded-xl font-bold font-righteous uppercase transition-all tracking-widest flex items-center gap-2 ${duetOnly ? 'bg-[var(--neon-cyan)] text-black shadow-[0_0_15px_rgba(0,229,255,0.4)]' : 'bg-black/50 text-slate-400 hover:text-white hover:bg-white/5'}`}>
              <span>Duets Only</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="relative">
            <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-2 ml-4 font-righteous">Song Title</label>
            <input
              type="text"
              value={songName}
              onChange={(e) => {
                setSongName(e.target.value);
                setShowSuggestions(true);
              }}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
              placeholder="TITLE"
              className="w-full bg-[#101015] border-2 border-white/10 rounded-2xl px-6 py-4 text-white font-bold focus:border-[var(--neon-pink)] outline-none transition-all uppercase shadow-inner text-sm font-righteous tracking-widest"
            />
            {showSuggestions && songName && suggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-[#101015] border-2 border-white/10 rounded-2xl shadow-xl z-50 max-h-48 overflow-y-auto custom-scrollbar">
                {suggestions
                  .filter(s => {
                    const q = songName.toLowerCase();
                    const matchSong = s.songName.toLowerCase().includes(q);
                    const matchArtist = s.artist.toLowerCase().includes(q);
                    let isMatch = false;
                    if (filterType === 'ALL') isMatch = matchSong || matchArtist;
                    else if (filterType === 'SONG') isMatch = matchSong;
                    else if (filterType === 'ARTIST') isMatch = matchArtist;

                    if (duetOnly) {
                      const isDuet = s.songName.toLowerCase().includes('duet') || s.artist.toLowerCase().includes('duet');
                      isMatch = isMatch && isDuet;
                    }
                    return isMatch;
                  })
                  .slice(0, 10)
                  .map((s, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setSongName(s.songName);
                        setArtist(s.artist);
                        if (s.youtubeUrl) setYoutubeUrl(s.youtubeUrl);
                        setShowSuggestions(false);
                      }}
                      className="w-full text-left px-6 py-3 hover:bg-[var(--neon-pink)]/20 hover:text-[var(--neon-pink)] border-b border-white/5 last:border-0 transition-colors"
                    >
                      <div className="text-sm font-bold uppercase font-righteous tracking-widest">{s.songName}</div>
                      <div className="text-xs text-slate-500 uppercase font-righteous opacity-80">{s.artist}</div>
                    </button>
                  ))}
              </div>
            )}
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
          <div className="flex justify-between items-end mb-2 ml-4">
            <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-widest font-righteous">YouTube URL (Optional)</label>
            <button
              type="button"
              onClick={() => {
                setShowYoutubeSearch(true);
                setYoutubeSearchQuery(`${songName} ${artist}`.trim());
              }}
              className="text-[9px] font-bold text-[var(--neon-pink)] uppercase tracking-widest hover:text-white transition-colors"
            >
              <span className="mr-1">🔍</span> SEARCH YOUTUBE
            </button>
          </div>
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

      {showYoutubeSearch && (
        <div className="absolute inset-0 bg-[#050510]/95 backdrop-blur-xl z-50 p-8 flex flex-col justify-start overflow-y-auto w-full h-full rounded-[3rem] border-4 border-[var(--neon-pink)]/50 animate-in fade-in zoom-in-95 duration-200">
          <div className="flex justify-between items-center mb-6">
            <h4 className="text-xl font-bold text-white font-bungee uppercase neon-text-glow-pink">YouTube Search</h4>
            <button
              type="button"
              onClick={() => setShowYoutubeSearch(false)}
              className="text-white hover:text-[var(--neon-pink)] transition-colors text-2xl"
            >×</button>
          </div>

          <div className="flex gap-2 mb-6">
            <input
              type="text"
              value={youtubeSearchQuery}
              onChange={(e) => setYoutubeSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleYoutubeSearch()}
              placeholder="Search song + artist..."
              className="flex-1 bg-[#101015] border-2 border-white/20 rounded-xl px-4 py-3 text-white font-bold focus:border-[var(--neon-pink)] outline-none transition-all uppercase text-sm font-righteous shadow-inner"
            />
            <button
              type="button"
              onClick={() => handleYoutubeSearch()}
              disabled={isSearchingYoutube}
              className="bg-[var(--neon-pink)] hover:bg-white hover:text-black text-white px-6 rounded-xl font-bold font-righteous uppercase text-sm transition-all shadow-[0_0_15px_rgba(255,0,127,0.5)] disabled:opacity-50"
            >
              {isSearchingYoutube ? '...' : 'GO'}
            </button>
          </div>

          <div className="flex-1 overflow-y-auto space-y-3 custom-scrollbar pr-2">
            {youtubeResults.map(video => (
              <div
                key={video.id}
                onClick={() => {
                  setYoutubeUrl(`https://www.youtube.com/watch?v=${video.id}`);
                  setShowYoutubeSearch(false);
                }}
                className="flex gap-4 p-3 rounded-xl bg-black/50 border-2 border-white/5 hover:border-[var(--neon-cyan)] cursor-pointer transition-all group items-center"
              >
                <img src={video.thumbnail} alt="thumbnail" className="w-24 h-18 object-cover rounded-lg shadow-md" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white font-bold font-righteous leading-tight line-clamp-2 group-hover:text-[var(--neon-cyan)] transition-colors">{video.title}</p>
                </div>
              </div>
            ))}
            {!isSearchingYoutube && youtubeResults.length === 0 && youtubeSearchQuery && (
              <div className="text-center text-slate-500 font-righteous text-sm mt-8">No results found or search not started. Make sure you have the API key setup.</div>
            )}
          </div>
        </div>
      )}

    </form>
  );
};

export default SongRequestForm;
