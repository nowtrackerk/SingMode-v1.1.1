import React from 'react';
import { SingModeLogo } from './common/SingModeLogo';

interface FeaturesViewProps {
    onBack: () => void;
}

const FeatureCard: React.FC<{ title: string; icon: string; description: string; items: string[] }> = ({ title, icon, description, items }) => (
    <div className="bg-[#101015] border border-white/5 p-10 rounded-[3.5rem] hover:border-[var(--neon-pink)] transition-all backdrop-blur-xl group relative overflow-hidden shadow-2xl">
        <div className="absolute top-0 right-0 w-32 h-32 bg-[var(--neon-pink)]/5 blur-3xl rounded-full -mr-16 -mt-16 group-hover:bg-[var(--neon-pink)]/10 transition-colors" />
        <div className="w-20 h-20 bg-black border border-white/10 rounded-2xl flex items-center justify-center text-4xl mb-8 group-hover:scale-110 group-hover:border-[var(--neon-pink)] group-hover:text-white transition-all shadow-2xl relative z-10">
            {icon}
        </div>
        <h3 className="text-3xl font-bold text-white font-bungee uppercase mb-4 tracking-tight group-hover:text-[var(--neon-pink)] transition-colors relative z-10 leading-none">{title}</h3>
        <p className="text-[var(--neon-cyan)]/70 mb-8 font-bold uppercase text-[10px] tracking-[0.2em] font-righteous leading-relaxed relative z-10 transition-opacity">{description}</p>
        <ul className="space-y-4 relative z-10">
            {items.map((item, i) => (
                <li key={i} className="flex items-start gap-3 text-[11px] text-slate-500 font-bold uppercase tracking-widest font-righteous group-hover:text-[var(--neon-cyan)] transition-colors">
                    <span className="text-[var(--neon-cyan)] font-bold">»</span>
                    {item}
                </li>
            ))}
        </ul>
    </div>
);

const FeaturesView: React.FC<FeaturesViewProps> = ({ onBack }) => {
    return (
        <div className="min-h-screen bg-[#050510] text-slate-200 p-6 md:p-16 relative overflow-hidden">
            {/* Background Accents */}
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[var(--neon-pink)] via-[var(--neon-purple)] to-[var(--neon-cyan)] z-50 animate-gradient-x"></div>
            <div className="absolute -top-[500px] -right-[500px] w-[1000px] h-[1000px] bg-[var(--neon-pink)]/5 blur-[200px] rounded-full"></div>
            <div className="absolute -bottom-[500px] -left-[500px] w-[1000px] h-[1000px] bg-[var(--neon-cyan)]/5 blur-[200px] rounded-full"></div>
            <div className="absolute top-0 left-0 w-full h-full bg-[url('/grid.svg')] opacity-5 pointer-events-none"></div>

            <div className="max-w-7xl mx-auto relative z-10">
                {/* Header */}
                <div className="flex justify-between items-center mb-24 animate-in fade-in slide-in-from-top-4 duration-700">
                    <div onClick={onBack} className="cursor-pointer hover:scale-105 transition-transform">
                        {/* Replaced SingModeLogo with direct img for consistency if needed, but keeping component is fine if it aligns */}
                        <div className="flex items-center gap-3">
                            <img src="IGK.jpeg" alt="Logo" className="w-10 h-10 rounded-full border border-[var(--neon-pink)]" />
                            <span className="font-bungee text-xl text-white tracking-widest">SINGMODE</span>
                        </div>
                    </div>
                    <button
                        onClick={onBack}
                        className="px-8 py-4 bg-black border border-white/10 hover:border-[var(--neon-pink)] text-slate-400 hover:text-white rounded-2xl font-bold text-[9px] uppercase tracking-widest font-righteous transition-all"
                    >
                        RETURN TO HUB
                    </button>
                </div>

                {/* Hero Section */}
                <div className="text-center max-w-4xl mx-auto mb-32 animate-in fade-in zoom-in duration-700 delay-100">
                    <h1 className="text-6xl md:text-8xl font-bold font-bungee text-white mb-8 tracking-tight uppercase leading-none neon-text-glow-purple">
                        The ultimate <span className="text-[var(--neon-cyan)]">karaoke</span> os
                    </h1>
                    <p className="text-[10px] md:text-xs text-[var(--neon-cyan)]/80 font-bold uppercase tracking-[0.4em] font-righteous leading-relaxed max-w-2xl mx-auto border-y border-[var(--neon-cyan)]/20 py-4">
                        SingMode transforms any arena into a high-fidelity visual theater.
                        Connect instantly, dominate the queue, and emit your signal.
                    </p>
                </div>

                {/* Features Grid */}
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 mb-32 animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-200">
                    <FeatureCard
                        title="DJ Console"
                        icon="🎧"
                        description="The command center for your sessions. Maintain signal flow."
                        items={[
                            "Real-time Queue Logic",
                            "Drag & Drop Sequencer",
                            "Instant Signal Auth",
                            "Master Output Control"
                        ]}
                    />
                    <FeatureCard
                        title="Singer Web"
                        icon="🎤"
                        description="A personal terminal for every guest. Eliminate analog friction."
                        items={[
                            "Identity Transmission",
                            "Smart Vector Search",
                            "High-Speed Requests",
                            "Live Sync Lyrics"
                        ]}
                    />
                    <FeatureCard
                        title="Theater Box"
                        icon="🎭"
                        description="A stunning visual matrix for the main screen. Pure aesthetics."
                        items={[
                            "Ultra-HD Playback",
                            "Generative Backgrounds",
                            "Active HUD Overlays",
                            "QR Signal Entrance"
                        ]}
                    />
                    <FeatureCard
                        title="Hybrid AI"
                        icon="✨"
                        description="Gemini integration enhances the arena with predictive logic."
                        items={[
                            "Vibe-Matched Vectors",
                            "Dynamic Visual Synthesis",
                            "Automated Interstitials",
                            "Identity Verification"
                        ]}
                    />
                    <FeatureCard
                        title="Sync Matrix"
                        icon="⚡"
                        description="Real-time P2P technology keeps the cluster in perfect sync."
                        items={[
                            "Zero-Latency State",
                            "Decentralized Design",
                            "Instant Node Creation",
                            "Omni-Device Support"
                        ]}
                    />
                    <FeatureCard
                        title="Prime Suite"
                        icon="💎"
                        description="Unlock premium protocols for venues and power units."
                        items={[
                            "Broadcast Protocols",
                            "Branding Overlays",
                            "Logic Routing",
                            "Priority Channel"
                        ]}
                    />
                </div>

                {/* CTA */}
                <div className="text-center animate-in fade-in duration-700 delay-500 pb-32">
                    <button
                        onClick={onBack}
                        className="px-16 py-8 bg-[var(--neon-cyan)] hover:bg-white text-black rounded-[3rem] font-bold text-2xl uppercase tracking-widest font-righteous shadow-[0_0_50px_rgba(34,211,238,0.4)] hover:scale-105 transition-all"
                    >
                        INITIATE SESSION
                    </button>
                </div>
            </div>
        </div>
    );
};

export default FeaturesView;
