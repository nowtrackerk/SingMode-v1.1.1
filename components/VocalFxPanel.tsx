import React, { useState } from 'react';
import { UserProfile } from '../types';

interface VocalFxPanelProps {
    userProfile: UserProfile | null;
    onSave: (settings: any) => Promise<void>;
}

const Knob: React.FC<{ label: string; value: number; onChange: (v: number) => void; min?: number; max?: number }> = ({ label, value, onChange, min = 0, max = 100 }) => {
    const [isDragging, setIsDragging] = useState(false);
    const [startY, setStartY] = useState(0);
    const [startVal, setStartVal] = useState(0);

    const handleMouseDown = (e: React.MouseEvent) => {
        setIsDragging(true);
        setStartY(e.clientY);
        setStartVal(value);
        document.body.style.cursor = 'ns-resize';
    };

    React.useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isDragging) return;
            const range = max - min;
            const diffY = startY - e.clientY; // Up increases
            const change = (diffY / 200) * range; // Sensitivity
            let newVal = startVal + change;
            newVal = Math.max(min, Math.min(max, newVal));
            onChange(Math.round(newVal));
        };

        const handleMouseUp = () => {
            setIsDragging(false);
            document.body.style.cursor = 'default';
        };

        if (isDragging) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        }
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging, startY, startVal, min, max, onChange]);

    const rotation = -135 + (value / (max - min)) * 270;

    return (
        <div className="flex flex-col items-center gap-2 group cursor-ns-resize" onMouseDown={handleMouseDown}>
            <div className="relative w-24 h-24 rounded-full bg-[#151520] border-2 border-white/5 shadow-[inset_0_4px_10px_rgba(0,0,0,0.5)] flex items-center justify-center group-hover:border-[var(--neon-cyan)] transition-colors">
                <div style={{ transform: `rotate(${rotation}deg)` }} className="w-full h-full absolute inset-0 transition-transform duration-75 ease-out pointer-events-none">
                    <div className="absolute top-2 left-1/2 -translate-x-1/2 w-1.5 h-4 bg-[var(--neon-cyan)] rounded-full shadow-[0_0_10px_var(--neon-cyan)]"></div>
                </div>
                <div className="absolute inset-0 rounded-full border border-white/5 pointer-events-none"></div>
                <div className="text-2xl font-bold font-bungee text-white select-none">{value}</div>
            </div>
            <span className="text-xs font-black uppercase tracking-[0.2em] font-righteous text-slate-500 group-hover:text-[var(--neon-cyan)] transition-colors select-none">{label}</span>
            <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden mt-1">
                <div style={{ width: `${((value - min) / (max - min)) * 100}%` }} className="h-full bg-[var(--neon-cyan)] transition-all"></div>
            </div>
        </div>
    );
};

const Slider: React.FC<{ label: string; value: number; onChange: (v: number) => void }> = ({ label, value, onChange }) => {
    return (
        <div className="flex flex-col items-center h-48 gap-2">
            <div className="flex-1 w-10 bg-[#151520] rounded-full relative border border-white/5 overflow-hidden group hover:border-[var(--neon-pink)] transition-colors">
                <input
                    type="range"
                    min="0"
                    max="100"
                    value={value}
                    onChange={(e) => onChange(Number(e.target.value))}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
                    // @ts-ignore
                    orient="vertical"
                    style={{ appearance: 'slider-vertical' } as any}
                />
                <div className="absolute bottom-0 left-0 w-full bg-[var(--neon-pink)]/20 transition-all pointer-events-none" style={{ height: `${value}%` }}></div>
                <div className="absolute bottom-0 left-0 w-full h-1 bg-[var(--neon-pink)] shadow-[0_0_15px_var(--neon-pink)] transition-all pointer-events-none z-10" style={{ bottom: `${value}%` }}></div>
            </div>
            <span className="text-[10px] font-black uppercase tracking-wider font-righteous text-slate-500">{label}</span>
            <span className="text-xs font-bold font-mono text-white">{value}</span>
        </div>
    );
};

const Toggle: React.FC<{ label: string; active: boolean; onToggle: () => void; color?: string }> = ({ label, active, onToggle, color = 'var(--neon-green)' }) => {
    return (
        <button onClick={onToggle} className={`w-full py-3 rounded-xl font-black uppercase tracking-[0.2em] text-xs transition-all border font-righteous ${active ? `bg-[${color}]/10 border-[${color}] text-[${color}] shadow-[0_0_15px_${color}]` : 'bg-white/5 border-white/5 text-slate-600 hover:text-white hover:border-white/20'}`}>
            {label}
            <div className={`w-full h-1 mt-2 rounded-full transition-all ${active ? `bg-[${color}]` : 'bg-transparent'}`}></div>
        </button>
    )
}

const VocalFxPanel: React.FC<VocalFxPanelProps> = ({ userProfile }) => {
    const [settings, setSettings] = useState({
        reverb: 35,
        echo: 10,
        gain: 75,
        eqLow: 50,
        eqMid: 50,
        eqHigh: 60,
        compression: 40,
        isRobot: false,
        isAlien: false,
        isMegaphone: false,
        presetName: 'Studio Clean'
    });

    const updateSetting = (key: string, val: any) => {
        setSettings(prev => ({ ...prev, [key]: val }));
    };

    const presets = ['Studio Clean', 'Concert Hall', 'Radio Lo-Fi', 'Space Station', 'Monster Voice'];

    return (
        <div className="space-y-8 animate-in slide-in-from-bottom-8 duration-500">

            {/* Top Vis / Header */}
            <div className="bg-[#101015] p-6 rounded-[2.5rem] border-2 border-white/5 relative overflow-hidden">
                <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[var(--neon-purple)] via-[var(--neon-pink)] to-[var(--neon-orange)] animate-gradient-x"></div>
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-white font-bungee text-2xl uppercase tracking-tight">VOCAL EFFECTS</h3>
                    <div className="flex items-center gap-2 px-3 py-1 bg-black/40 rounded-lg border border-white/10">
                        <div className="w-2 h-2 rounded-full bg-[var(--neon-green)] animate-pulse"></div>
                        <span className="text-[10px] font-righteous text-[var(--neon-green)] tracking-widest uppercase">FX ON</span>
                    </div>
                </div>

                {/* Visualizer Placeholder */}
                <div className="h-24 bg-black/40 rounded-2xl border border-white/5 flex items-end justify-center gap-1 p-2 overflow-hidden mb-6 relative">
                    <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20"></div>
                    {[...Array(30)].map((_, i) => (
                        <div key={i} className="flex-1 bg-[var(--neon-purple)] rounded-t-sm animate-pulse" style={{
                            height: `${20 + Math.random() * 80}%`,
                            animationDelay: `${i * 0.05}s`,
                            opacity: 0.6 + Math.random() * 0.4
                        }}></div>
                    ))}
                </div>

                {/* Main Controls - Knobs */}
                <div className="grid grid-cols-3 gap-4 mb-8">
                    <Knob label="REVERB" value={settings.reverb} onChange={(v) => updateSetting('reverb', v)} />
                    <Knob label="ECHO" value={settings.echo} onChange={(v) => updateSetting('echo', v)} />
                    <Knob label="MIC VOL" value={settings.gain} onChange={(v) => updateSetting('gain', v)} />
                </div>

                {/* Sliders - EQ */}
                <div className="grid grid-cols-4 gap-2 bg-black/20 p-4 rounded-2xl border border-white/5 mb-6">
                    <Slider label="BASS" value={settings.eqLow} onChange={(v) => updateSetting('eqLow', v)} />
                    <Slider label="MIDS" value={settings.eqMid} onChange={(v) => updateSetting('eqMid', v)} />
                    <Slider label="TREBLE" value={settings.eqHigh} onChange={(v) => updateSetting('eqHigh', v)} />
                    <Slider label="CLARITY" value={settings.compression} onChange={(v) => updateSetting('compression', v)} />
                </div>

                {/* Toggles */}
                <div className="grid grid-cols-3 gap-3 mb-6">
                    <Toggle label="ROBOT" active={settings.isRobot} onToggle={() => updateSetting('isRobot', !settings.isRobot)} color="var(--neon-blue)" />
                    <Toggle label="ALIEN" active={settings.isAlien} onToggle={() => updateSetting('isAlien', !settings.isAlien)} color="var(--neon-green)" />
                    <Toggle label="MEGAPHONE" active={settings.isMegaphone} onToggle={() => updateSetting('isMegaphone', !settings.isMegaphone)} color="var(--neon-orange)" />
                </div>

                {/* Preset Loader */}
                <div className="flex gap-4 items-center bg-[#151520] p-2 rounded-xl border border-white/5">
                    <span className="text-xs font-black text-slate-500 uppercase tracking-widest pl-2">PRESET:</span>
                    <select
                        value={settings.presetName}
                        onChange={(e) => updateSetting('presetName', e.target.value)}
                        className="flex-1 bg-black text-white font-righteous text-sm py-2 px-3 rounded-lg border-none outline-none focus:ring-1 ring-[var(--neon-purple)]"
                    >
                        {presets.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                    <button className="px-4 py-2 bg-[var(--neon-purple)]/20 hover:bg-[var(--neon-purple)] text-[var(--neon-purple)] hover:text-white rounded-lg font-black text-xs uppercase tracking-wider transition-all">SAVE</button>
                </div>

            </div>

        </div>
    );
};

export default VocalFxPanel;
