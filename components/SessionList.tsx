import React, { useEffect, useState } from 'react';
import { ActiveSession } from '../types';
import { subscribeToSessions } from '../services/sessionManager';
import { getNetworkUrl } from '../services/networkUtils';

interface SessionListProps {
    onJoin: (sessionId: string) => void;
}

const SessionList: React.FC<SessionListProps> = ({ onJoin }) => {
    const [sessions, setSessions] = useState<ActiveSession[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = subscribeToSessions((updatedSessions) => {
            setSessions(updatedSessions);
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    if (loading) {
        return (
            <div className="text-center py-20 animate-pulse">
                <div className="text-[var(--neon-cyan)] text-xl font-black uppercase tracking-widest font-righteous">SEARCHING FOR STAGES...</div>
            </div>
        );
    }

    if (sessions.length === 0) {
        return (
            <div className="text-center py-20 px-6 bg-black/20 rounded-[3rem] border-2 border-dashed border-white/5 mx-auto max-w-2xl">
                <p className="text-[var(--neon-pink)] text-2xl font-black uppercase tracking-widest font-bungee mb-4">NO STAGES FOUND</p>
                <p className="text-slate-500 font-righteous uppercase tracking-wider text-sm">There are no active sessions nearby.</p>
            </div>
        );
    }

    return (
        <div className="w-full max-w-4xl mx-auto p-4 space-y-6 animate-in fade-in slide-in-from-bottom-8 duration-700">
            <div className="flex items-center gap-4 mb-8">
                <div className="w-3 h-3 bg-[var(--neon-green)] rounded-full animate-ping"></div>
                <h2 className="text-[var(--neon-green)] font-black uppercase tracking-[0.3em] font-righteous text-lg">LIVE STAGES</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {sessions.map((session) => (
                    <div key={session.id} className="group relative bg-[#101015] border-2 border-white/5 hover:border-[var(--neon-cyan)] p-8 rounded-[2.5rem] transition-all hover:-translate-y-2 hover:shadow-[0_0_50px_rgba(0,229,255,0.15)] overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-br from-[var(--neon-cyan)]/0 via-transparent to-[var(--neon-purple)]/0 group-hover:from-[var(--neon-cyan)]/5 group-hover:to-[var(--neon-purple)]/5 transition-all duration-500"></div>

                        <div className="relative z-10">
                            <div className="flex justify-between items-start mb-6">
                                <div className="w-16 h-16 bg-black border border-white/10 rounded-2xl flex items-center justify-center text-3xl shadow-xl group-hover:scale-110 transition-transform duration-500 group-hover:border-[var(--neon-cyan)]">
                                    🎵
                                </div>
                                <div className="px-3 py-1 bg-[var(--neon-green)]/10 text-[var(--neon-green)] border border-[var(--neon-green)]/20 rounded-lg text-[10px] font-black uppercase tracking-widest font-righteous">
                                    ONLINE
                                </div>
                            </div>

                            <h3 className="text-3xl font-bold text-white mb-2 font-bungee uppercase tracking-tight group-hover:text-[var(--neon-cyan)] transition-colors truncate">
                                {session.venueName || "OPEN MIC"}
                            </h3>

                            <div className="flex items-center gap-2 mb-8 text-slate-400 font-righteous uppercase tracking-wider text-xs">
                                <span className="text-[var(--neon-pink)]">HOST:</span> {session.hostName}
                            </div>

                            <button
                                onClick={() => onJoin(session.id)}
                                className="w-full py-4 bg-white text-black font-black uppercase tracking-[0.2em] rounded-xl hover:bg-[var(--neon-cyan)] transition-all font-righteous hover:scale-[1.02] active:scale-95 shadow-lg"
                            >
                                JOIN STAGE
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default SessionList;
