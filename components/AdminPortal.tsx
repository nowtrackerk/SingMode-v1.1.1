import React, { useState, useEffect } from 'react';
import { KaraokeSession } from '../types';
import { getSession, saveSession, logoutUser, administrativeCleanup, cleanupStaleSessions } from '../services/sessionManager';
import { db } from '../services/firebaseConfig';
import { collection, getDocs, doc, getDoc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { RequestStatus } from '../types';

interface AdminPortalProps {
    onBack: () => void;
}

const AdminPortal: React.FC<AdminPortalProps> = ({ onBack }) => {
    const [activeTab, setActiveTab] = useState<'SETTINGS' | 'ANALYTICS' | 'USERS' | 'SESSIONS'>('SETTINGS');
    const [allUsers, setAllUsers] = useState<any[]>([]);
    const [allSessions, setAllSessions] = useState<any[]>([]);

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

    const [candidates, setCandidates] = useState<{ id: string, name: string }[]>([]);
    const [isScanning, setIsScanning] = useState(false);
    const [selectedId, setSelectedId] = useState<string>('');

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

            try {
                // Load Users
                const usersRef = collection(db, "users");
                const usersSnap = await getDocs(usersRef);
                setAllUsers(usersSnap.docs.map(doc => doc.data()));

                // Load Sessions
                const sessRef = collection(db, "sessions");
                const sessSnap = await getDocs(sessRef);
                setAllSessions(sessSnap.docs.map(d => ({ id: d.id, ...d.data() })));
            } catch (e) {
                console.error("Failed to load admin data:", e);
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

    const findRestoreCandidates = async () => {
        setIsScanning(true);
        try {
            const sessionsRef = collection(db, "sessions");
            const sessionsSnap = await getDocs(sessionsRef);
            const foundUsers = new Map<string, string>();

            for (const doc of sessionsSnap.docs) {
                const data = doc.data();
                if (!data.fullState) continue;
                try {
                    const sess = JSON.parse(data.fullState);
                    const all = [...(sess.requests || []), ...(sess.history || [])];
                    all.forEach((r: any) => {
                        if (r.participantId && r.participantName) {
                            foundUsers.set(r.participantId, r.participantName);
                        }
                    });
                } catch (e) { }
            }

            // Check which ones are already in the users collection to mark them?
            // For now, just show all unique ones found in history
            const list = Array.from(foundUsers.entries()).map(([id, name]) => ({ id, name }));
            setCandidates(list.sort((a, b) => a.name.localeCompare(b.name)));
            if (list.length === 0) alert("No candidates found in history.");
        } catch (e: any) {
            alert("Scan failed: " + e.message);
        } finally {
            setIsScanning(false);
        }
    };

    const restoreUser = async (userId: string, userName: string) => {
        try {
            askConfirm(`Restore ${userName} and their full song history?`, async () => {
                const userRef = doc(db, "users", userId);
                const userSnap = await getDoc(userRef);

                if (!userSnap.exists()) {
                    await setDoc(userRef, {
                        id: userId,
                        name: userName,
                        favorites: [],
                        personalHistory: [],
                        createdAt: Date.now()
                    });
                }

                // Gather history from all sessions
                const sessionsRef = collection(db, "sessions");
                const sessionsSnap = await getDocs(sessionsRef);
                const allDoneSongs: any[] = [];

                for (const d of sessionsSnap.docs) {
                    const data = d.data();
                    if (!data.fullState) continue;
                    try {
                        const sess = JSON.parse(data.fullState);
                        const songs = [...(sess.requests || []), ...(sess.history || [])];
                        songs.forEach((s: any) => {
                            if (s.participantId === userId && s.status === RequestStatus.DONE) {
                                allDoneSongs.push(s);
                            }
                        });
                    } catch (e) { }
                }

                const currentUserObj = (await getDoc(userRef)).data();
                if (currentUserObj) {
                    let pHistory = currentUserObj.personalHistory || [];
                    let addedCount = 0;
                    for (const song of allDoneSongs) {
                        const exists = pHistory.some((h: any) => h.id === song.id || (h.songName.toLowerCase() === song.songName.toLowerCase() && h.artist.toLowerCase() === song.artist.toLowerCase()));
                        if (!exists) {
                            pHistory.unshift({ ...song, status: RequestStatus.DONE, completedAt: song.completedAt || Date.now() });
                            addedCount++;
                        }
                    }
                    await updateDoc(userRef, { personalHistory: pHistory.slice(0, 50) });
                    alert(`SUCCESS: Restored ${userName} with ${addedCount} new historical entries.`);
                }
            });
        } catch (e: any) {
            alert("Restoration error: " + e.message);
        }
    };

    if (!session) return null;

    return (
        <div className="min-h-screen bg-[#050510] text-white p-6 md:p-16 relative overflow-hidden font-righteous">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[var(--neon-pink)] via-[var(--neon-purple)] to-[var(--neon-cyan)] z-50 animate-gradient-x"></div>

            <div className="max-w-4xl mx-auto relative z-10">
                <header className="flex justify-between items-center mb-10 animate-in fade-in slide-in-from-top-4 duration-700">
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

                <div className="mb-8 p-4 bg-[var(--neon-green)]/20 border-2 border-[var(--neon-green)] rounded-2xl flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <span className="text-2xl">⚡</span>
                        <div>
                            <h3 className="text-[var(--neon-green)] font-black uppercase text-sm">System Update: Admin Insights Active</h3>
                            <p className="text-[10px] text-slate-400 font-bold uppercase">Multi-User Restoration Tool is now available in System Maintenance</p>
                        </div>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex bg-[#0a0a0a] p-2 rounded-2xl border border-white/5 shadow-inner mb-10 overflow-x-auto gap-2 scrollbar-hide">
                    {(['SETTINGS', 'ANALYTICS', 'USERS', 'SESSIONS']).map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab as any)}
                            className={`flex-1 py-4 px-6 rounded-xl text-xs font-black uppercase tracking-widest transition-all font-righteous whitespace-nowrap ${activeTab === tab
                                ? 'bg-[#151520] text-[var(--neon-cyan)] shadow-[0_0_20px_rgba(0,229,255,0.1)] border border-[var(--neon-cyan)]/30'
                                : 'text-slate-600 hover:text-white hover:bg-white/5 border border-transparent'
                                }`}
                        >
                            {tab}
                        </button>
                    ))}
                </div>

                {activeTab === 'SETTINGS' && (
                    <div className="grid md:grid-cols-2 gap-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
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
                                <p className="text-[10px] text-slate-500 uppercase tracking-widest font-black opacity-60">DATABASE PURGE & RECOVERY</p>
                            </div>

                            <div className="flex flex-col md:flex-row gap-6">

                                <div className="flex-1 p-6 bg-white/5 rounded-2xl border border-[var(--neon-green)] shadow-[0_0_20px_rgba(0,255,0,0.1)]">
                                    <h4 className="text-xs font-black uppercase tracking-widest mb-1 text-[var(--neon-green)]">Data Recovery</h4>
                                    <p className="text-[9px] text-slate-500 uppercase font-bold mb-4">Restore lost users and history from session archives</p>

                                    <div className="space-y-4">
                                        <button
                                            onClick={findRestoreCandidates}
                                            disabled={isScanning}
                                            className={`w-full px-6 py-3 bg-[var(--neon-green)]/10 border border-[var(--neon-green)] hover:bg-[var(--neon-green)] text-[var(--neon-green)] hover:text-black rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${isScanning ? 'opacity-50' : ''}`}
                                        >
                                            {isScanning ? 'SCANNING HISTORIES...' : 'SCAN FOR CANDIDATES'}
                                        </button>

                                        {candidates.length > 0 && (
                                            <div className="space-y-3 animate-in fade-in slide-in-from-top-2">
                                                <select
                                                    value={selectedId}
                                                    onChange={(e) => setSelectedId(e.target.value)}
                                                    className="w-full bg-black/60 border border-white/10 rounded-xl px-4 py-3 text-xs font-bold uppercase text-white outline-none focus:border-[var(--neon-green)]"
                                                >
                                                    <option value="">SELECT USER TO RESTORE</option>
                                                    {candidates.map(c => (
                                                        <option key={c.id} value={c.id}>{c.name} ({c.id.slice(0, 5)}...)</option>
                                                    ))}
                                                </select>

                                                <button
                                                    onClick={() => {
                                                        const match = candidates.find(c => c.id === selectedId);
                                                        if (match) restoreUser(match.id, match.name);
                                                        else alert("Please select a candidate first.");
                                                    }}
                                                    className="w-full px-6 py-4 bg-[var(--neon-green)] text-black rounded-xl text-xs font-black uppercase tracking-widest hover:scale-[1.02] active:scale-95 transition-all shadow-lg"
                                                >
                                                    RESTORE SELECTED USER
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>

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

                        <div className="col-span-full mt-8 flex justify-center">
                            <button
                                onClick={handleSave}
                                className="px-16 py-6 bg-white text-black rounded-[2rem] font-bold text-xl uppercase tracking-widest font-bungee hover:bg-[var(--neon-cyan)] transition-all shadow-2xl hover:scale-105 active:scale-95"
                            >
                                SAVE CHANGES
                            </button>
                        </div>
                    </div>
                )}

                {activeTab === 'ANALYTICS' && (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-8">
                        <div>
                            <h2 className="text-2xl font-bungee text-[var(--neon-pink)] mb-2 uppercase">Platform Analytics</h2>
                            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-black opacity-60">OVERVIEW & METRICS</p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="bg-[#101015] border-2 border-[var(--neon-cyan)]/30 rounded-3xl p-8 shadow-[0_0_30px_rgba(0,229,255,0.05)]">
                                <h3 className="text-sm font-righteous uppercase tracking-widest text-[#05d9e8] mb-4">Total Users</h3>
                                <p className="text-6xl font-bungee text-white">{allUsers.length}</p>
                            </div>
                            <div className="bg-[#101015] border-2 border-[var(--neon-pink)]/30 rounded-3xl p-8 shadow-[0_0_30px_rgba(255,0,127,0.05)]">
                                <h3 className="text-sm font-righteous uppercase tracking-widest text-[#ff007f] mb-4">Total Sessions</h3>
                                <p className="text-6xl font-bungee text-white">{allSessions.length}</p>
                            </div>
                            <div className="bg-[#101015] border-2 border-[var(--neon-green)]/30 rounded-3xl p-8 shadow-[0_0_30px_rgba(0,255,0,0.05)]">
                                <h3 className="text-sm font-righteous uppercase tracking-widest text-[#00ff9d] mb-4">Completed Songs</h3>
                                <p className="text-6xl font-bungee text-white">
                                    {allUsers.reduce((sum, u) => sum + (u.personalHistory?.length || 0), 0)}
                                </p>
                            </div>
                        </div>

                        <div className="bg-black/40 border-2 border-white/5 rounded-3xl p-8 mt-10">
                            <h3 className="text-sm font-righteous uppercase tracking-widest text-slate-400 mb-6">Top Performers</h3>
                            <div className="space-y-4">
                                {allUsers
                                    .filter(u => u.personalHistory && u.personalHistory.length > 0)
                                    .sort((a, b) => b.personalHistory.length - a.personalHistory.length)
                                    .slice(0, 5)
                                    .map((u, i) => (
                                        <div key={u.id} className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/5">
                                            <div className="flex items-center gap-4">
                                                <div className="w-8 h-8 rounded-full bg-[var(--neon-purple)]/20 border border-[var(--neon-purple)] flex items-center justify-center text-xs font-bungee">{i + 1}</div>
                                                <span className="font-bold text-lg uppercase tracking-wide">{u.name || 'Unknown'}</span>
                                            </div>
                                            <div className="text-[var(--neon-cyan)] font-black text-xl">{u.personalHistory.length} <span className="text-xs text-slate-500 ml-1">SONGS</span></div>
                                        </div>
                                    ))}
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'USERS' && (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6">
                        <div>
                            <h2 className="text-2xl font-bungee text-[var(--neon-cyan)] mb-2 uppercase">User Directory</h2>
                            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-black opacity-60">MANAGE SINGERS & GUESTS</p>
                        </div>

                        <div className="bg-black/40 border-2 border-white/5 rounded-3xl overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead className="bg-white/5 border-b border-white/10 text-[10px] font-black uppercase tracking-widest text-slate-400">
                                        <tr>
                                            <th className="p-4 pl-6">Name</th>
                                            <th className="p-4">ID</th>
                                            <th className="p-4">Songs Sung</th>
                                            <th className="p-4 pr-6 text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {allUsers.map((u) => (
                                            <tr key={u.id} className="hover:bg-white/5 transition-colors">
                                                <td className="p-4 pl-6 font-bold uppercase">{u.name}</td>
                                                <td className="p-4 font-mono text-xs opacity-50">{u.id}</td>
                                                <td className="p-4 font-bold text-[var(--neon-cyan)]">{u.personalHistory?.length || 0}</td>
                                                <td className="p-4 pr-6 text-right">
                                                    <button
                                                        onClick={() => {
                                                            askConfirm(`Are you sure you want to delete user ${u.name}? This cannot be easily undone.`, async () => {
                                                                await deleteDoc(doc(db, "users", u.id));
                                                                setAllUsers(allUsers.filter(user => user.id !== u.id));
                                                            });
                                                        }}
                                                        className="px-3 py-1.5 bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white rounded border border-rose-500/30 transition-all text-[10px] uppercase font-black tracking-widest"
                                                    >
                                                        Delete
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'SESSIONS' && (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6">
                        <div>
                            <h2 className="text-2xl font-bungee text-[var(--neon-purple)] mb-2 uppercase">Session Backlog</h2>
                            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-black opacity-60">PREVIOUS & ACTIVE EVENTS</p>
                        </div>

                        <div className="space-y-4">
                            {allSessions.map(s => {
                                let timeStr = 'Unknown';
                                if (s.createdAt) {
                                    timeStr = new Date(s.createdAt).toLocaleString();
                                }
                                let sessionObj = null;
                                if (s.fullState) {
                                    try {
                                        sessionObj = JSON.parse(s.fullState);
                                    } catch (e) { }
                                }
                                const songCount = sessionObj ? (sessionObj.requests?.length || 0) + (sessionObj.history?.length || 0) : 0;
                                const particCount = sessionObj ? (sessionObj.participants?.length || 0) : 0;

                                return (
                                    <div key={s.id} className="bg-black/40 border-2 border-white/5 rounded-3xl p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                                        <div>
                                            <div className="flex items-center gap-3 mb-2">
                                                <span className={`w-3 h-3 rounded-full ${s.isLive ? 'bg-[var(--neon-green)] animate-pulse shadow-[0_0_10px_var(--neon-green)]' : 'bg-slate-600'}`}></span>
                                                <h3 className="text-xl font-bold font-righteous uppercase tracking-wider">{s.id}</h3>
                                            </div>
                                            <p className="text-xs text-slate-500 font-mono tracking-widest uppercase">{timeStr}</p>
                                        </div>
                                        <div className="flex gap-6 items-center">
                                            <div className="text-center">
                                                <div className="text-sm font-black text-[var(--neon-pink)] uppercase tracking-widest">Performers</div>
                                                <div className="text-2xl font-bungee">{particCount}</div>
                                            </div>
                                            <div className="text-center">
                                                <div className="text-sm font-black text-[var(--neon-cyan)] uppercase tracking-widest">Songs</div>
                                                <div className="text-2xl font-bungee">{songCount}</div>
                                            </div>
                                            <button
                                                onClick={() => {
                                                    askConfirm(`Are you sure you want to permanently delete session archive ${s.id}?`, async () => {
                                                        await deleteDoc(doc(db, "sessions", s.id));
                                                        setAllSessions(allSessions.filter(sess => sess.id !== s.id));
                                                    });
                                                }}
                                                className="w-10 h-10 flex items-center justify-center bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white rounded-xl border border-rose-500/30 transition-all shrink-0 ml-4"
                                            >
                                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
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
