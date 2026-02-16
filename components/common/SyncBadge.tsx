import React, { useState, useEffect } from 'react';
import { ViewRole } from '../../types';
import { syncService } from '../../services/syncService';

export const SyncBadge: React.FC<{ role: ViewRole }> = ({ role }) => {
    const [status, setStatus] = useState<'connected' | 'disconnected' | 'connecting'>('disconnected');
    const [roomId, setRoomId] = useState<string | null>(null);

    useEffect(() => {
        syncService.onConnectionStatus = setStatus;
        const interval = setInterval(() => {
            setRoomId(syncService.getRoomId());
        }, 1000);
        return () => clearInterval(interval);
    }, []);

    if (role === 'SELECT') return null;

    const getStatusColor = () => {
        if (status === 'connected') return 'bg-[var(--neon-cyan)] shadow-[0_0_10px_var(--neon-cyan)]';
        if (status === 'connecting') return 'bg-[var(--neon-purple)] shadow-[0_0_10px_var(--neon-purple)]';
        return 'bg-[var(--neon-pink)] shadow-[0_0_10px_var(--neon-pink)]';
    };

    const getStatusTextColor = () => {
        if (status === 'connected') return 'text-[var(--neon-cyan)]';
        if (status === 'connecting') return 'text-[var(--neon-purple)]';
        return 'text-[var(--neon-pink)]';
    };

    const getStatusText = () => {
        if (role === 'DJ') return `HUB: ${roomId || 'INITIALIZING...'}`;
        if (status === 'connected') return 'LINKED';
        if (status === 'connecting') return 'SYNCING...';
        return 'OFFLINE';
    };

    return (
        <div className="fixed bottom-6 left-6 z-[60] flex items-center gap-3 bg-[#101015]/90 backdrop-blur-xl px-4 py-3 rounded-2xl border border-white/10 shadow-2xl group hover:border-[var(--neon-pink)] transition-all animate-in slide-in-from-bottom-4 duration-700">
            <div className="relative flex h-2 w-2">
                <div className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-40 ${getStatusColor()}`}></div>
                <div className={`relative inline-flex rounded-full h-2 w-2 ${getStatusColor()}`}></div>
            </div>
            <span className={`text-[9px] font-black uppercase tracking-[0.3em] font-righteous ${getStatusTextColor()} drop-shadow-md`}>
                {getStatusText()}
            </span>
        </div>
    );
};
