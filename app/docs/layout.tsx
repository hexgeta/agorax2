'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { LiquidGlassCard } from '@/components/ui/liquid-glass';
import PixelBlastBackground from '@/components/ui/PixelBlastBackground';

interface NavItem {
  title: string;
  href: string;
  children?: NavItem[];
}

const navigation: NavItem[] = [
  {
    title: 'Getting Started',
    href: '/docs',
    children: [
      { title: 'Introduction', href: '/docs' },
      { title: 'Quick Start', href: '/docs/quick-start' },
    ],
  },
  {
    title: 'Core Concepts',
    href: '/docs/concepts',
    children: [
      { title: 'How It Works', href: '/docs/concepts/how-it-works' },
      { title: 'Order Types', href: '/docs/concepts/order-types' },
      { title: 'Token Compatibility', href: '/docs/concepts/token-compatibility' },
      { title: 'Pricing & Fees', href: '/docs/concepts/pricing-fees' },
    ],
  },
  {
    title: 'User Guide',
    href: '/docs/guide',
    children: [
      { title: 'Creating Orders', href: '/docs/guide/creating-orders' },
      { title: 'Filling Orders', href: '/docs/guide/filling-orders' },
      { title: 'Managing Orders', href: '/docs/guide/managing-orders' },
    ],
  },
  {
    title: 'Technical Reference',
    href: '/docs/technical',
    children: [
      { title: 'Smart Contract', href: '/docs/technical/smart-contract' },
      { title: 'API Reference', href: '/docs/technical/api-reference' },
      { title: 'Data Structures', href: '/docs/technical/data-structures' },
    ],
  },
  {
    title: 'Security',
    href: '/docs/security',
    children: [
      { title: 'Audit Report', href: '/docs/security/audit' },
      { title: 'Security Features', href: '/docs/security/features' },
    ],
  },
];

function NavSection({
  item,
  pathname,
  isExpanded,
  onToggle
}: {
  item: NavItem;
  pathname: string;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const isActive = pathname === item.href;
  const hasActiveChild = item.children?.some(child => pathname === child.href);

  return (
    <div className="mb-4">
      <button
        onClick={onToggle}
        className={`flex items-center justify-between w-full text-left text-sm font-semibold py-2 px-3 rounded-lg transition-colors ${
          isActive || hasActiveChild
            ? 'text-white bg-white/10'
            : 'text-white/70 hover:text-white hover:bg-white/5'
        }`}
      >
        {item.title}
        {item.children && (
          <svg
            className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        )}
      </button>
      {item.children && isExpanded && (
        <div className="ml-3 mt-1 border-l border-white/10 pl-3 space-y-1">
          {item.children.map((child) => (
            <Link
              key={child.href}
              href={child.href}
              className={`block text-sm py-1.5 px-2 rounded transition-colors ${
                pathname === child.href
                  ? 'text-white bg-white/10'
                  : 'text-white/60 hover:text-white hover:bg-white/5'
              }`}
            >
              {child.title}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

// Find which section contains the current path
function findActiveSection(pathname: string): string | null {
  for (const item of navigation) {
    if (pathname === item.href) return item.href;
    if (item.children?.some(child => pathname === child.href)) return item.href;
  }
  return navigation[0]?.href || null;
}

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [expandedSection, setExpandedSection] = useState<string | null>(() => findActiveSection(pathname));

  // Update expanded section when route changes
  useEffect(() => {
    setExpandedSection(findActiveSection(pathname));
  }, [pathname]);

  // Close sidebar on route change
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  // Prevent body scroll when sidebar is open on mobile
  useEffect(() => {
    if (sidebarOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [sidebarOpen]);

  return (
    <div className="min-h-screen relative">
      {/* Background */}
      <div className="fixed inset-0 z-0">
        <PixelBlastBackground />
      </div>

      {/* Top Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50">
        <LiquidGlassCard
          className="w-full px-4 md:px-8 py-4 !rounded-none"
          shadowIntensity="none"
          glowIntensity="sm"
          blurIntensity="xl"
        >
          <div className="max-w-[1400px] mx-auto flex items-center justify-between">
            <div className="flex items-center gap-4">
              {/* Mobile menu toggle */}
              <button
                className="md:hidden p-2 text-white/80 hover:text-white"
                onClick={() => setSidebarOpen(!sidebarOpen)}
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>

              <Link href="/" className="flex items-center gap-2">
                <Image
                  src="/logo.svg"
                  alt="AgoráX"
                  width={120}
                  height={32}
                  className="h-6 md:h-8 w-auto"
                  priority
                />
              </Link>
              <span className="text-white/40 text-lg hidden md:inline">/</span>
              <span className="text-white font-medium hidden md:inline">Documentation</span>
            </div>

            <div className="flex items-center gap-4">
              <Link
                href="/trade"
                className="text-white/80 hover:text-white text-sm font-medium transition-colors"
              >
                Launch App
              </Link>
            </div>
          </div>
        </LiquidGlassCard>
      </nav>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-[73px] left-0 bottom-0 w-72 z-40 transform transition-transform duration-200 ease-out md:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <LiquidGlassCard
          className="h-full overflow-y-auto py-6 px-4 !rounded-none !rounded-tr-2xl !rounded-br-2xl md:!rounded-none"
          shadowIntensity="none"
          glowIntensity="sm"
          blurIntensity="xl"
        >
          <nav className="space-y-2">
            {navigation.map((item) => (
              <NavSection
                key={item.href}
                item={item}
                pathname={pathname}
                isExpanded={expandedSection === item.href}
                onToggle={() => setExpandedSection(expandedSection === item.href ? null : item.href)}
              />
            ))}
          </nav>

          {/* Footer Links */}
          <div className="mt-8 pt-6 border-t border-white/10">
            <div className="space-y-2">
              <a
                href="https://otter.pulsechain.com/address/0xc8a47F14b1833310E2aC72e4C397b5b14a9FEf8B"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-white/60 hover:text-white transition-colors px-3 py-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                Block Explorer
              </a>
              <a
                href="https://github.com/agorax"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-white/60 hover:text-white transition-colors px-3 py-2"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
                </svg>
                GitHub
              </a>
            </div>
          </div>
        </LiquidGlassCard>
      </aside>

      {/* Main Content */}
      <main className="relative z-10 pt-[73px] md:pl-72">
        <div className="max-w-4xl mx-auto px-4 md:px-8 py-4 md:py-4">
          {children}
        </div>
      </main>
    </div>
  );
}
