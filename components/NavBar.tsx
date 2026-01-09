'use client'

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { ConnectButton } from './ConnectButton';
import { ChainSwitcher } from './ChainSwitcher';
import { TESTING_MODE } from '@/config/testing';
// import { NotificationBell } from './NotificationBell';

const NavBar = () => {
  const pathname = usePathname();
  const [hoveredPath, setHoveredPath] = useState<string | null>(null);
  return (
    <nav className="w-full bg-black bg-blur-[6.65px] px-8 py-4 relative md:fixed top-0 left-0 right-0 z-[200] border-b border-white/20">
      <div className="max-w-[1200px] mx-auto">
        {/* Mobile: Stacked layout, Desktop: Single row */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 md:gap-0">
          {/* Top row on mobile: Logo + Notification */}
          <div className="flex items-center justify-between">
            <Link href="/" className="text-white font-bold text-xl md:text-3xl">
              AgoráX
            </Link>
            {/* Notification Bell - Mobile only (next to logo) */}
            {/* <div className="md:hidden">
              <NotificationBell />
            </div> */}
          </div>

          {/* Bottom row on mobile: Buttons / Right side on desktop */}
          <div className="flex flex-col md:flex-row items-stretch md:items-center gap-2 md:gap-4">
            {/* Notification Bell - Desktop only (with other buttons) */}
            {/* <div className="hidden md:block">
              <NotificationBell />
            </div> */}
            {/* Navigation Links */}
            <Link
              href="/"
              className={`transition-colors font-medium text-sm md:text-base px-4 py-2 cursor-pointer group ${pathname === '/'
                ? 'text-white'
                : 'text-white/80 hover:text-white'
                }`}
              onMouseEnter={() => setHoveredPath('/')}
              onMouseLeave={() => setHoveredPath(null)}
            >
              <span className="relative inline-block">
                My Orders
                <span className={`absolute bottom-[-4px] left-0 w-full h-0.5 bg-white transition-transform duration-300 ease-out ${pathname === '/'
                  ? (hoveredPath && hoveredPath !== '/' ? 'scale-x-0 origin-left' : 'scale-x-100 origin-left')
                  : 'scale-x-0 group-hover:scale-x-100 origin-left'
                  }`}
                />
              </span>
            </Link>
            <Link
              href="/marketplace"
              className={`transition-colors font-medium text-sm md:text-base px-4 py-2 cursor-pointer group ${pathname === '/marketplace'
                ? 'text-white'
                : 'text-white/80 hover:text-white'
                }`}
              onMouseEnter={() => setHoveredPath('/marketplace')}
              onMouseLeave={() => setHoveredPath(null)}
            >
              <span className="relative inline-block">
                Marketplace
                <span className={`absolute bottom-[-4px] left-0 w-full h-0.5 bg-white transition-transform duration-300 ease-out ${pathname === '/marketplace'
                  ? (hoveredPath && hoveredPath !== '/marketplace' ? 'scale-x-0 origin-left' : 'scale-x-100 origin-left')
                  : 'scale-x-0 group-hover:scale-x-100 origin-left'
                  }`}
                />
              </span>
            </Link>

            {/* Only show chain switcher in testing mode */}
            {TESTING_MODE && <ChainSwitcher isCheckingConnection={false} />}
            <ConnectButton />
          </div>
        </div>
      </div>
    </nav>
  );
};

export default NavBar; 