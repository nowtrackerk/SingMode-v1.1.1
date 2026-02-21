import React, { useState, useEffect } from 'react';
import { KaraokeSession } from '../types';
import { getSession, saveSession, logoutUser, administrativeCleanup, cleanupStaleSessions } from '../services/sessionManager';

interface AdminPortalProps {
    onBack: () => void;
}

const AdminPortal: React.FC<AdminPortalProps> = ({ onBack }) => {
    const [session, setSession] = useState<KaraokeSession | null>(null);
    const [venueName, setVenueName] = useState('');
    const [isBusiness, setIsBusiness] = useState(false);
    const [theme, setTheme] = useState({
        primary: '#ff007f',
        secondary: '#05d9e8',
        accent: '#feff3f'
    });

    const [confirmState, setConfirmState] = useState<{
        isOpen: boolean;
        message: string;
        onConfirm: () => void | Promise<void>;
    }>({
        isOpen: false,
        message: '',
        onConfirm: () => { }
    });

    const askConfirm = (message: string, onConfirm: () => void | Promise<void>) => {
        setConfirmState({
            isOpen: true,
            message,
            onConfirm
        });
    };

    useEffect(() => {
        const load = async () => {
            const s = await getSession();
            setSession(s);
            if (s.brandIdentity) {
                setVenueName(s.brandIdentity.venueName);
                setIsBusiness(s.brandIdentity.isBusinessAccount);
            }
            if (s.customTheme) {
                setTheme({
                    primary: s.customTheme.primaryNeon,
                    secondary: s.customTheme.secondaryNeon,
                    accent: s.customTheme.accentNeon
                });
            }
        };
        load();
    }, []);

    const handleSave = async () => {
        if (!session) return;
        const updated = { ...session };
        updated.brandIdentity = {
            venueName,
            isBusinessAccount: isBusiness,
            logoUrl: updated.brandIdentity?.logoUrl
        };
        updated.customTheme = {
            primaryNeon: theme.primary,
            secondaryNeon: theme.secondary,
            accentNeon: theme.accent
        };
        await saveSession(updated);
        // Apply theme to CSS variables
        document.documentElement.style.setProperty('--neon-pink', theme.primary);
        document.documentElement.style.setProperty('--neon-cyan', theme.secondary);
        document.documentElement.style.setProperty('--neon-yellow', theme.accent);
        alert('Configurations locked in.');
    };

    if (!session) return null;

    return (
        <div className="min-h-screen bg-[#050510] text-white p-6 md:p-16 relative overflow-hidden font-righteous">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[var(--neon-pink)] via-[var(--neon-purple)] to-[var(--neon-cyan)] z-50 animate-gradient-x"></div>

            <div className="max-w-4xl mx-auto relative z-10">
                <header className="flex justify-between items-center mb-20 animate-in fade-in slide-in-from-top-4 duration-700">
                    <div onClick={onBack} className="cursor-pointer group flex items-center gap-4">
                        <img src="IGK.jpeg" alt="Logo" className="w-12 h-12 rounded-full border-2 border-[var(--neon-pink)] group-hover:scale-110 transition-all" />
                        <h1 className="text-3xl font-bungee tracking-tight">ADMIN SETTINGS</h1>
                    </div>
                    <div className="flex gap-4">
                        <button onClick={onBack} className="px-6 py-3 bg-black border border-white/10 hover:border-white text-slate-500 hover:text-white rounded-xl text-[10px] uppercase tracking-widest transition-all">CLOSE MENU</button>
                        <button
                            onClick={() => {
                                askConfirm('Are you sure you want to sign out?', async () => {
                                    await logoutUser();
                                    window.location.reload();
                                });
                            }}
                            className="px-6 py-3 bg-rose-500/10 border border-rose-500/30 hover:bg-rose-500 text-rose-500 hover:text-white rounded-xl text-[10px] uppercase tracking-widest transition-all flex items-center gap-2"
                        >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
                            LOG OUT
                        </button>
                    </div>
                </header>

                <div className="grid md:grid-cols-2 gap-10">
                    {/* Brand Identity Section */}
                    <section className="bg-black/40 border-2 border-white/5 rounded-[3rem] p-10 space-y-8 shadow-2xl">
                        <div>
                            <h2 className="text-2xl font-bungee text-[var(--neon-cyan)] mb-2 uppercase">Venue Settings</h2>
                            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-black opacity-60">VENUE DISPLAY</p>
                        </div>

                        <div className="space-y-6">
                            <div>
                                <label className="block text-[9px] text-slate-500 uppercase tracking-widest mb-2 ml-4">Venue Display Name</label>
                                <input
                                    type="text"
                                    value={venueName}
                                    onChange={(e) => setVenueName(e.target.value)}
                                    placeholder="Enter Venue Name"
                                    className="w-full bg-black/60 border-2 border-white/10 rounded-2xl px-6 py-4 text-white font-bold outline-none focus:border-[var(--neon-cyan)] transition-all uppercase"
                                />
                            </div>

                            <div className="flex items-center justify-between p-6 bg-white/5 rounded-2xl border border-white/5">
                                <div>
                                    <h4 className="text-xs font-black uppercase tracking-widest mb-1">Business Account</h4>
                                    <p className="text-[9px] text-slate-500 uppercase font-bold">Unlocks Revenue Stream Matrix</p>
                                </div>
                                <button
                                    onClick={() => setIsBusiness(!isBusiness)}
                                    className={`w-14 h-8 rounded-full transition-all relative ${isBusiness ? 'bg-[var(--neon-cyan)]' : 'bg-slate-800'}`}
                                >
                                    <div className={`absolute top-1 w-6 h-6 rounded-full bg-white transition-all ${isBusiness ? 'right-1' : 'left-1'}`}></div>
                                </button>
                            </div>
                        </div>
                    </section>

                    {/* Theme Editor Section */}
                    <section className="bg-black/40 border-2 border-white/5 rounded-[3rem] p-10 space-y-8 shadow-2xl">
                        <div>
                            <h2 className="text-2xl font-bungee text-[var(--neon-pink)] mb-2 uppercase">Theme Matrix</h2>
                            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-black opacity-60">THEME COLORS</p>
                        </div>

                        <div className="space-y-6">
                            <div className="grid grid-cols-1 gap-4">
                                <div className="flex items-center justify-between bg-white/5 p-4 rounded-xl border border-white/5">
                                    <label className="text-[10px] uppercase font-black tracking-widest">Primary Neon</label>
                                    <input type="color" value={theme.primary} onChange={(e) => setTheme({ ...theme, primary: e.target.value })} className="bg-transparent border-none w-10 h-10 cursor-pointer" />
                                </div>
                                <div className="flex items-center justify-between bg-white/5 p-4 rounded-xl border border-white/5">
                                    <label className="text-[10px] uppercase font-black tracking-widest">Secondary Neon</label>
                                    <input type="color" value={theme.secondary} onChange={(e) => setTheme({ ...theme, secondary: e.target.value })} className="bg-transparent border-none w-10 h-10 cursor-pointer" />
                                </div>
                                <div className="flex items-center justify-between bg-white/5 p-4 rounded-xl border border-white/5">
                                    <label className="text-[10px] uppercase font-black tracking-widest">Accent Neon</label>
                                    <input type="color" value={theme.accent} onChange={(e) => setTheme({ ...theme, accent: e.target.value })} className="bg-transparent border-none w-10 h-10 cursor-pointer" />
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* Maintenance Section */}
                    <section className="bg-black/40 border-2 border-white/5 rounded-[3rem] p-10 space-y-8 shadow-2xl col-span-full">
                        <div>
                            <h2 className="text-2xl font-bungee text-rose-500 mb-2 uppercase">System Maintenance</h2>
                            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-black opacity-60">DATABASE PURGE OPERATIONS</p>
                        </div>

                        <div className="flex flex-col md:flex-row gap-6">
                            <div className="flex-1 p-6 bg-white/5 rounded-2xl border border-white/5">
                                <h4 className="text-xs font-black uppercase tracking-widest mb-1 text-white">Account Optimization</h4>
                                <p className="text-[9px] text-slate-500 uppercase font-bold mb-4">Deletes all guests and duplicate entries</p>
                                <button
                                    onClick={() => {
                                        askConfirm('DANGER: This will permanently delete all guest accounts and duplicate stage names. Proceed?', async () => {
                                            const res = await administrativeCleanup();
                                            if (res.success) {
                                                alert(`Cleanup complete. Deleted ${res.deletedCount} items.`);
                                            } else {
                                                alert(`Cleanup failed: ${res.error}`);
                                            }
                                        });
                                    }}
                                    className="px-6 py-3 bg-rose-500/10 border border-rose-500 hover:bg-rose-500 text-rose-500 hover:text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                                >
                                    PURGE GUESTS & DUPLICATES
                                </button>
                            </div>

                            <div className="flex-1 p-6 bg-white/5 rounded-2xl border border-white/5">
                                <h4 className="text-xs font-black uppercase tracking-widest mb-1 text-white">Signal Maintenance</h4>
                                <p className="text-[9px] text-slate-500 uppercase font-bold mb-4">Cleans up dead or abandoned stage signals</p>
                                <button
                                    onClick={() => {
                                        askConfirm('This will remove all inactive or stale stage sessions from the public list. Proceed?', async () => {
                                            const res = await cleanupStaleSessions();
                                            if (res.success) {
                                                alert(`Signal cleanup complete. Removed ${res.deletedCount} stale sessions.`);
                                            } else {
                                                alert(`Cleanup failed: ${res.error}`);
                                            }
                                        });
                                    }}
                                    className="px-6 py-3 bg-[var(--neon-purple)]/10 border border-[var(--neon-purple)] hover:bg-[var(--neon-purple)] text-[var(--neon-purple)] hover:text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                                >
                                    PURGE STALE SIGNALS
                                </button>
                            </div>
                        </div>
                    </section>
                </div>

                <div className="mt-12 flex justify-center">
                    <button
                        onClick={handleSave}
                        className="px-16 py-6 bg-white text-black rounded-[2rem] font-bold text-xl uppercase tracking-widest font-bungee hover:bg-[var(--neon-cyan)] transition-all shadow-2xl hover:scale-105 active:scale-95"
                    >
                        SAVE CHANGES
                    </button>
                </div>
            </div>
            {confirmState.isOpen && (
                <div className="fixed inset-0 bg-black/95 flex items-center justify-center p-4 z-[300] backdrop-blur-3xl animate-in fade-in duration-300">
                    <div className="w-full max-w-md bg-[#050510] border-4 border-[var(--neon-pink)]/30 rounded-[3rem] p-10 text-center shadow-[0_0_100px_rgba(255,42,109,0.3)] animate-in zoom-in-95 duration-300 relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-1 bg-[var(--neon-pink)] shadow-[0_0_20px_rgba(255,42,109,0.8)]"></div>
                        <div className="w-20 h-20 bg-[var(--neon-pink)]/10 text-[var(--neon-pink)] rounded-[2rem] border-2 border-[var(--neon-pink)]/20 flex items-center justify-center mx-auto mb-6 text-4xl font-black shadow-[0_0_30px_rgba(255,42,109,0.2)] animate-pulse">⚠️</div>
                        <h2 className="text-5xl font-black text-white uppercase mb-4 tracking-tight font-bungee neon-text-glow-pink">CONFIRM</h2>
                        <p className="text-slate-400 text-lg mb-8 leading-relaxed font-black font-righteous uppercase tracking-widest">
                            {confirmState.message}
                        </p>
                        <div className="flex gap-4">
                            <button
                                onClick={() => setConfirmState(prev => ({ ...prev, isOpen: false }))}
                                className="flex-1 py-4 bg-black border-2 border-white/10 text-white rounded-xl text-base font-black uppercase tracking-widest font-righteous transition-all hover:bg-white/5"
                            >
                                CANCEL
                            </button>
                            <button
                                onClick={async () => {
                                    setConfirmState(prev => ({ ...prev, isOpen: false }));
                                    await confirmState.onConfirm();
                                }}
                                className="flex-[2] py-4 bg-[var(--neon-pink)] text-white rounded-xl text-base font-black uppercase tracking-widest font-righteous shadow-[0_0_30px_rgba(255,42,109,0.4)] transition-all hover:bg-rose-400 hover:scale-105"
                            >
                                PROCEED
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminPortal;
