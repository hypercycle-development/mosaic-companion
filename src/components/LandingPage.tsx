import React from 'react';
import { Command } from 'lucide-react';

interface LandingPageProps {
    onNavigate: (url: string) => void;
    customGreeting?: string;
    theme: 'light' | 'dark';
    toggleTheme: () => void;
    onOpenCommandPalette?: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({
    onNavigate,
    customGreeting,
    onOpenCommandPalette
}) => {
    return (
        <div className='relative flex flex-col items-center justify-center h-full w-full bg-gray-950 text-white overflow-hidden select-none'>
            {/* Background Grid Effect */}
            <div
                className='absolute inset-0 z-0 opacity-10'
                style={{
                    backgroundImage:
                        'linear-gradient(rgba(79, 70, 229, 0.2) 1px, transparent 1px), linear-gradient(90deg, rgba(79, 70, 229, 0.2) 1px, transparent 1px)',
                    backgroundSize: '40px 40px'
                }}
            />
            <div className='absolute inset-0 z-0 bg-gradient-to-t from-gray-950 via-gray-950/80 to-transparent pointer-events-none' />

            <div className='relative z-10 flex flex-col items-center gap-8 max-w-5xl w-full px-4'>
                {/* Logo & Branding */}
                <div className='text-center space-y-6'>
                    <div className='inline-block relative group'>
                        <h1 className='text-8xl md:text-9xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-white to-gray-600 drop-shadow-[0_0_25px_rgba(255,255,255,0.1)]'>
                            MOSAIC
                        </h1>
                        {/* Glow effect behind text */}
                        <div className='absolute -inset-4 bg-indigo-500/10 blur-3xl rounded-full -z-10 group-hover:bg-indigo-500/20 transition-all duration-1000' />
                    </div>
                </div>

                {/* Action Buttons */}
                {onOpenCommandPalette && (
                    <div className='mt-12 flex items-center gap-4 justify-center'>
                        <button
                            onClick={onOpenCommandPalette}
                            className='group relative px-6 py-3 bg-gray-900/50 border border-gray-800 rounded-full hover:bg-gray-800 transition-all duration-300'
                            title='Open Command Palette (Cmd+K)'
                        >
                            <div className='flex items-center gap-2'>
                                <Command
                                    size={16}
                                    className='text-gray-400 group-hover:text-indigo-400'
                                />
                                <span className='text-xs font-mono text-gray-500 group-hover:text-gray-300'>
                                    ⌘K
                                </span>
                            </div>
                        </button>
                    </div>
                )}

                {/* Status Indicators */}
                <div className='mt-16 flex gap-8 opacity-60'>
                    <div className='flex flex-col items-center gap-1'>
                        <div className='w-2 h-2 rounded-full bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.8)] animate-pulse' />
                        <span className='text-[10px] uppercase tracking-widest text-gray-500'>
                            System Online
                        </span>
                    </div>
                    <div className='flex flex-col items-center gap-1'>
                        <div className='w-2 h-2 rounded-full bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.8)]' />
                        <span className='text-[10px] uppercase tracking-widest text-gray-500'>
                            Neural Link Active
                        </span>
                    </div>
                    <div className='flex flex-col items-center gap-1'>
                        <div className='w-2 h-2 rounded-full bg-cyan-500 shadow-[0_0_10px_rgba(6,182,212,0.8)]' />
                        <span className='text-[10px] uppercase tracking-widest text-gray-500'>
                            Privacy Shielded
                        </span>
                    </div>
                </div>
            </div>

            {/* Decorative Corners for Techy Feel */}
            <div className='absolute top-8 left-8 w-32 h-32 border-t border-l border-gray-800 rounded-tl-3xl opacity-50' />
            <div className='absolute top-8 right-8 w-32 h-32 border-t border-r border-gray-800 rounded-tr-3xl opacity-50' />
            <div className='absolute bottom-8 left-8 w-32 h-32 border-b border-l border-gray-800 rounded-bl-3xl opacity-50' />
            <div className='absolute bottom-8 right-8 w-32 h-32 border-b border-r border-gray-800 rounded-br-3xl opacity-50' />
        </div>
    );
};
