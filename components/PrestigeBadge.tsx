'use client'

import Link from 'next/link'

// Prestige badge component - shows highest completed prestige (Alpha for now as example)
export const PrestigeBadge = () => (
  <Link href="/achievements" className="relative h-[42px] md:h-[50px] aspect-square bg-rose-500/20 rounded-full cursor-pointer transition-all duration-500 hover:bg-rose-500/40 border border-rose-500/50 overflow-hidden group flex-shrink-0 flex items-center justify-center">
    <span className="relative z-10 text-rose-400 font-bold text-lg md:text-xl">α</span>
    <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-100">
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-rose-400/40 to-transparent animate-shimmer" style={{animationDuration: '1s'}} />
    </div>
  </Link>
)