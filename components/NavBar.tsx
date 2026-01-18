'use client'

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { ConnectButton } from './ConnectButton';
import { ChainSwitcher } from './ChainSwitcher';
import { TESTING_MODE } from '@/config/testing';
import { LiquidGlassCard } from '@/components/ui/liquid-glass';
// import { NotificationBell } from './NotificationBell';

const NavBar = () => {
  const pathname = usePathname();
  const [hoveredPath, setHoveredPath] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { isConnected } = useAccount();

  // Close mobile menu when route changes
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    if (mobileMenuOpen) {
      // Lock both html and body to prevent scrolling on all browsers/devices
      document.documentElement.style.overflow = 'hidden';
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.width = '100%';
      document.body.style.top = `-${window.scrollY}px`;
    } else {
      const scrollY = document.body.style.top;
      document.documentElement.style.overflow = '';
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
      document.body.style.top = '';
      // Restore scroll position
      if (scrollY) {
        window.scrollTo(0, parseInt(scrollY || '0') * -1);
      }
    }
    return () => {
      document.documentElement.style.overflow = '';
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
      document.body.style.top = '';
    };
  }, [mobileMenuOpen]);

  // Close mobile menu when resizing to desktop to prevent flashing
  useEffect(() => {
    const mediaQuery = window.matchMedia('(min-width: 768px)');
    const handleChange = (e: MediaQueryListEvent) => {
      if (e.matches) {
        setMobileMenuOpen(false);
      }
    };
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  return (
    <>
      <nav className="w-full fixed top-0 left-0 right-0 z-[200]">
        <LiquidGlassCard
          className="w-full px-4 md:px-8 py-4 !rounded-none"
          shadowIntensity="none"
          glowIntensity="sm"
          blurIntensity="xl"
        >
          <div className="max-w-[1200px] mx-auto">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <Link href="/" className="flex items-center">
              <Image
                src="/logo.svg"
                alt="AgoráX"
                width={120}
                height={32}
                className="h-6 md:h-8 w-auto"
                priority
              />
            </Link>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center gap-4">
              {isConnected && (
                <Link
                  href="/"
                  className={`transition-colors font-medium text-base px-4 py-2 cursor-pointer group ${pathname === '/'
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
              )}
              <Link
                href="/marketplace"
                className={`transition-colors font-medium text-base px-4 py-2 cursor-pointer group ${pathname === '/marketplace'
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
              <Link
                href="/leaderboard"
                className={`transition-colors font-medium text-base px-4 py-2 cursor-pointer group ${pathname === '/leaderboard'
                  ? 'text-white'
                  : 'text-white/80 hover:text-white'
                  }`}
                onMouseEnter={() => setHoveredPath('/leaderboard')}
                onMouseLeave={() => setHoveredPath(null)}
              >
                <span className="relative inline-block">
                  Leaderboard
                  <span className={`absolute bottom-[-4px] left-0 w-full h-0.5 bg-white transition-transform duration-300 ease-out ${pathname === '/leaderboard'
                    ? (hoveredPath && hoveredPath !== '/leaderboard' ? 'scale-x-0 origin-left' : 'scale-x-100 origin-left')
                    : 'scale-x-0 group-hover:scale-x-100 origin-left'
                    }`}
                  />
                </span>
              </Link>

              {TESTING_MODE && <ChainSwitcher isCheckingConnection={false} />}
              <ConnectButton />
            </div>

            {/* Mobile: Hamburger / Close Button */}
            <button
              className="md:hidden relative w-8 h-8 flex items-center justify-center"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle menu"
              aria-expanded={mobileMenuOpen}
            >
              <svg
                width="28"
                height="28"
                viewBox="0 0 32 32"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="overflow-visible"
              >
                {/* Hamburger lines / X */}
                <line
                  className="transition-all duration-300 ease-out"
                  style={{
                    transformOrigin: '16px 16px',
                    transform: mobileMenuOpen ? 'rotate(45deg)' : 'rotate(0deg) translateY(-8px)'
                  }}
                  x1="6" y1="16" x2="26" y2="16"
                  stroke="white"
                  strokeWidth="3"
                  strokeLinecap="round"
                />
                <line
                  className={`transition-all duration-300 ease-out ${mobileMenuOpen ? 'opacity-0 scale-0' : 'opacity-100 scale-100'}`}
                  style={{ transformOrigin: '16px 16px' }}
                  x1="6" y1="16" x2="26" y2="16"
                  stroke="white"
                  strokeWidth="3"
                  strokeLinecap="round"
                />
                <line
                  className="transition-all duration-300 ease-out"
                  style={{
                    transformOrigin: '16px 16px',
                    transform: mobileMenuOpen ? 'rotate(-45deg)' : 'rotate(0deg) translateY(8px)'
                  }}
                  x1="6" y1="16" x2="26" y2="16"
                  stroke="white"
                  strokeWidth="3"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>
          </div>
        </LiquidGlassCard>
      </nav>

      {/* Mobile Menu Overlay - hidden on desktop via state, not media query to avoid flash */}
      {/* Only render when open to prevent invisible elements from intercepting clicks */}
      {mobileMenuOpen && (
      <div
        className="fixed inset-0 z-[199] animate-in fade-in duration-150 overflow-hidden touch-none"
        aria-hidden={!mobileMenuOpen}
      >
        {/* Backdrop - fully opaque black */}
        <div
          className="absolute inset-0 bg-black"
          onClick={() => setMobileMenuOpen(false)}
        />

        {/* Menu Content */}
        <div
          className="absolute inset-x-0 top-[73px] bottom-0 flex flex-col items-center justify-start pt-12 gap-6 animate-in slide-in-from-top-2 duration-150 overflow-hidden"
        >
          {/* Navigation Links */}
          <nav className="flex flex-col items-center gap-2 w-full px-8">
            {isConnected && (
              <Link
                href="/"
                onClick={() => setMobileMenuOpen(false)}
                className={`text-xl font-medium py-3 px-6 rounded-lg transition-colors w-full text-center ${pathname === '/'
                  ? 'text-white bg-white/10'
                  : 'text-white/80 hover:text-white hover:bg-white/5'
                  }`}
              >
                My Orders
              </Link>
            )}
            <Link
              href="/marketplace"
              onClick={() => setMobileMenuOpen(false)}
              className={`text-xl font-medium py-3 px-6 rounded-lg transition-colors w-full text-center ${pathname === '/marketplace'
                ? 'text-white bg-white/10'
                : 'text-white/80 hover:text-white hover:bg-white/5'
                }`}
            >
              Marketplace
            </Link>
            <Link
              href="/leaderboard"
              onClick={() => setMobileMenuOpen(false)}
              className={`text-xl font-medium py-3 px-6 rounded-lg transition-colors w-full text-center ${pathname === '/leaderboard'
                ? 'text-white bg-white/10'
                : 'text-white/80 hover:text-white hover:bg-white/5'
                }`}
            >
              Leaderboard
            </Link>
          </nav>

          {/* Divider */}
          <div className="w-32 h-px bg-white/20" />

          {/* Connect Button */}
          <div className="flex flex-col items-center gap-4 px-8 w-full">
            {TESTING_MODE && <ChainSwitcher isCheckingConnection={false} />}
            <div className="w-full [&>*]:w-full [&>*>button]:w-full">
              <ConnectButton />
            </div>
          </div>
        </div>
      </div>
      )}
    </>
  );
};

export default NavBar; 