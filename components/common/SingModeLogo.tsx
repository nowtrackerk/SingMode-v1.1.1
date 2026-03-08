import React from 'react';

export const SingModeLogo: React.FC<{ size?: 'sm' | 'md' | 'lg', className?: string }> = ({ size = 'md', className = '' }) => {
    const sizes = {
        sm: 'w-10 h-10 text-[10px]',
        md: 'w-14 h-14 text-sm',
        lg: 'w-28 h-28 text-2xl'
    };

    return (
        <div className={`flex items-center gap-4 ${className} group cursor-pointer`}>
            <div className={`${sizes[size]} bg-black border-2 border-cyan-400 rounded-2xl flex items-center justify-center font-black text-cyan-400 shadow-[0_0_20px_rgba(34,211,238,0.2)] transition-all group-hover:neon-border-pink group-hover:text-pink-500 group-hover:scale-110 font-bungee`}>
                SM
            </div>
            <div className="font-bungee tracking-tighter flex flex-col leading-none">
                <span className="text-pink-500 text-[0.5em] tracking-[0.5em] mb-1 font-righteous uppercase">Terminal</span>
                <span className="text-white uppercase group-hover:neon-glow-pink transition-all">Singmode v.2</span>
            </div>
        </div>
    );
};
