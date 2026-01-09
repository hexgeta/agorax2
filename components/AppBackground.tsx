'use client';

import React from 'react';

export function AppBackground() {
    return (
        <div className='fixed top-0 left-0 w-full h-full z-0 pointer-events-none overflow-hidden'>
            <div className="absolute inset-0 bg-gradient-to-br from-[#73bfc4]/20 via-[#ff810a]/10 to-[#8da0ce]/20 animate-gradient-shift" />
            <div className="absolute inset-0 bg-gradient-to-tl from-[#8da0ce]/15 via-transparent to-[#73bfc4]/15 animate-gradient-shift-reverse" />
        </div>
    );
}
