'use client';

import { useState, useEffect, useMemo, useRef, useCallback, Suspense } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { LiquidGlassCard } from '@/components/ui/liquid-glass';
import PixelBlastBackground from '@/components/ui/PixelBlastBackground';

interface NavItem {
  title: string;
  href: string;
  children?: NavItem[];
}

// Searchable content index for docs
interface SearchableDoc {
  title: string;
  href: string;
  content: string; // Searchable content/description
  section: string;
}

const searchableDocs: SearchableDoc[] = [
  { title: 'Introduction', href: '/docs', content: 'AgoráX is a decentralized OTC limit order platform on PulseChain. Trade any token at your price with up to 50 accepted payment tokens per order. Key features include limit orders, OTC trading, and secure audited contracts.', section: 'Getting Started' },
  { title: 'Quick Start', href: '/docs/quick-start', content: 'Get started with AgoráX in minutes. Connect your wallet, navigate to swap, select tokens, set your price using percentage buttons or the chart, approve and create your order, then monitor and manage your trades.', section: 'Getting Started' },
  { title: 'How It Works', href: '/docs/concepts/how-it-works', content: 'AgoráX uses a decentralized escrow mechanism. When you create an order, your tokens are held securely in the smart contract. Buyers can fill orders partially or completely. Sellers can claim proceeds and cancel unfilled portions anytime.', section: 'Core Concepts' },
  { title: 'Order Types', href: '/docs/concepts/order-types', content: 'Two order types: Partial Fill allows buyers to purchase any amount up to total. All-or-Nothing requires the entire order to be filled at once. Set expiration dates and accept multiple payment tokens.', section: 'Core Concepts' },
  { title: 'Token Compatibility', href: '/docs/concepts/token-compatibility', content: 'Any standard ERC20 token can be sold. Buy tokens must be whitelisted including PLS, WPLS, HEX, PLSX, INC, DAI, and more. Fee-on-transfer and rebasing tokens are not supported.', section: 'Core Concepts' },
  { title: 'Pricing & Fees', href: '/docs/concepts/pricing-fees', content: 'Listing fee is 100 PLS per order. 0.2% seller fee on trades, zero fees for buyers. Set prices above or below market using percentage buttons (+1%, +2%, +5%, +10%) or drag the limit line on the price chart.', section: 'Core Concepts' },
  { title: 'Creating Orders', href: '/docs/guide/creating-orders', content: 'Step-by-step guide to creating limit orders. Select sell token and amount, choose accepted buy tokens, set your price above market, approve token spending, pay the listing fee, and confirm the transaction.', section: 'User Guide' },
  { title: 'Filling Orders', href: '/docs/guide/filling-orders', content: 'Browse the marketplace to find orders. Use filters for status, fill percentage, minimum USD, position relative to market. Select an order, choose payment token, enter fill amount, approve and confirm.', section: 'User Guide' },
  { title: 'Managing Orders', href: '/docs/guide/managing-orders', content: 'View all your orders in My Orders page. Claim proceeds from filled orders, cancel unfilled portions to reclaim tokens, track order status and fill history. Filter by active, expired, completed.', section: 'User Guide' },
  { title: 'Smart Contract', href: '/docs/technical/smart-contract', content: 'Technical reference for the AgoráX smart contract. Contract address 0xc8a47F14b1833310E2aC72e4C397b5b14a9FEf8B on PulseChain mainnet. Functions include createOrder, fillOrder, cancelOrder, claimProceeds.', section: 'Technical Reference' },
  { title: 'Data Structures', href: '/docs/technical/data-structures', content: 'TypeScript interfaces for order data. OrderDetails includes orderId, maker, sellToken, sellAmount, buyTokens, buyAmounts, expiration, isAllOrNothing. CompleteOrderDetails adds computed fields.', section: 'Technical Reference' },
  { title: 'Audit Report', href: '/docs/security/audit', content: 'Security audit findings and report. Contract reviewed for vulnerabilities including reentrancy, integer overflow, access control. All critical and high severity issues resolved before mainnet launch.', section: 'Security' },
  { title: 'Security Features', href: '/docs/security/features', content: 'Non-custodial design means you control your funds. Escrow only holds sell tokens during active orders. No admin keys or upgrade mechanisms. Permissionless and trustless trading on PulseChain.', section: 'Security' },
];

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
}: {
  item: NavItem;
  pathname: string;
}) {
  return (
    <div className="mb-6">
      {/* Section header - not clickable, just a label */}
      <h4 className="text-base font-semibold text-white/50 uppercase tracking-wider px-3 mb-2">
        {item.title}
      </h4>
      {/* Always show children */}
      {item.children && (
        <div className="space-y-1">
          {item.children.map((child) => (
            <Link
              key={child.href}
              href={child.href}
              className={`block text-lg py-2 px-3 rounded-md transition-colors ${
                pathname === child.href
                  ? 'text-white bg-white/10 font-medium'
                  : 'text-white hover:bg-white/5'
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

// Component to handle search highlight from URL params (needs Suspense)
function SearchHighlighter() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const highlightQuery = searchParams.get('highlight');

  useEffect(() => {
    if (!highlightQuery) return;

    const timer = setTimeout(() => {
      const mainContent = document.querySelector('main');
      if (!mainContent) return;

      const words = highlightQuery.toLowerCase().split(/\s+/).filter(w => w.length > 1);
      const allTerms = highlightQuery.length > 2 ? [highlightQuery, ...words] : words;
      if (allTerms.length === 0) return;

      // Create TreeWalker to find text nodes
      const walker = document.createTreeWalker(
        mainContent,
        NodeFilter.SHOW_TEXT,
        null
      );

      const nodesToHighlight: { node: Text; matches: { start: number; end: number; term: string }[] }[] = [];
      let firstMatch: Element | null = null;

      // Find all text nodes with matches
      let currentNode: Text | null;
      while ((currentNode = walker.nextNode() as Text | null)) {
        const text = currentNode.textContent || '';
        const textLower = text.toLowerCase();
        const matches: { start: number; end: number; term: string }[] = [];

        for (const term of allTerms) {
          let idx = 0;
          while (idx < textLower.length) {
            const foundIdx = textLower.indexOf(term.toLowerCase(), idx);
            if (foundIdx === -1) break;
            matches.push({ start: foundIdx, end: foundIdx + term.length, term: text.slice(foundIdx, foundIdx + term.length) });
            idx = foundIdx + 1;
          }
        }

        if (matches.length > 0) {
          // Sort matches by position and remove overlaps
          matches.sort((a, b) => a.start - b.start);
          const filtered: typeof matches = [];
          for (const m of matches) {
            if (filtered.length === 0 || m.start >= filtered[filtered.length - 1].end) {
              filtered.push(m);
            }
          }
          nodesToHighlight.push({ node: currentNode, matches: filtered });
        }
      }

      // Apply highlights
      for (const { node, matches } of nodesToHighlight) {
        const parent = node.parentNode;
        if (!parent) continue;

        const text = node.textContent || '';
        const fragment = document.createDocumentFragment();
        let lastIdx = 0;

        for (const { start, end, term } of matches) {
          if (start > lastIdx) {
            fragment.appendChild(document.createTextNode(text.slice(lastIdx, start)));
          }
          const mark = document.createElement('mark');
          mark.className = 'search-highlight bg-yellow-500/50 text-white px-0.5 rounded';
          mark.textContent = term;
          fragment.appendChild(mark);
          if (!firstMatch) firstMatch = mark;
          lastIdx = end;
        }

        if (lastIdx < text.length) {
          fragment.appendChild(document.createTextNode(text.slice(lastIdx)));
        }

        parent.replaceChild(fragment, node);
      }

      // Scroll to first match
      if (firstMatch) {
        firstMatch.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }

      // Remove highlights after 3 seconds
      setTimeout(() => {
        const highlights = document.querySelectorAll('.search-highlight');
        highlights.forEach(el => {
          const text = el.textContent || '';
          el.replaceWith(document.createTextNode(text));
        });
        router.replace(pathname, { scroll: false });
      }, 3000);
    }, 100);

    return () => clearTimeout(timer);
  }, [highlightQuery, pathname, router]);

  return null;
}

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [scrollTop, setScrollTop] = useState(0);
  const [scrollBottom, setScrollBottom] = useState(1); // 1 = not at bottom, 0 = at bottom
  const navRef = useRef<HTMLElement>(null);

  // Filter docs based on search query with multiple excerpts
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const query = searchQuery.toLowerCase();
    const words = query.split(/\s+/).filter(w => w.length > 1);

    const results = searchableDocs.map(doc => {
      const titleLower = doc.title.toLowerCase();
      const contentLower = doc.content.toLowerCase();
      const sectionLower = doc.section.toLowerCase();

      // Calculate relevance score
      let score = 0;
      const excerpts: string[] = [];
      const matchedPositions = new Set<number>();

      // Exact title match is highest priority
      if (titleLower.includes(query)) {
        score += 100;
      }

      // Word matches in title
      words.forEach(word => {
        if (titleLower.includes(word)) score += 20;
      });

      // Section match
      if (sectionLower.includes(query)) score += 10;

      // Find all matching excerpts in content
      const findExcerpts = (searchTerm: string) => {
        let idx = 0;
        while (idx < contentLower.length) {
          const foundIdx = contentLower.indexOf(searchTerm, idx);
          if (foundIdx === -1) break;

          // Check if we already have an excerpt covering this position
          let alreadyCovered = false;
          for (const pos of matchedPositions) {
            if (Math.abs(pos - foundIdx) < 60) {
              alreadyCovered = true;
              break;
            }
          }

          if (!alreadyCovered) {
            matchedPositions.add(foundIdx);
            const start = Math.max(0, foundIdx - 40);
            const end = Math.min(doc.content.length, foundIdx + searchTerm.length + 60);
            const excerpt = (start > 0 ? '...' : '') +
              doc.content.slice(start, end).trim() +
              (end < doc.content.length ? '...' : '');
            excerpts.push(excerpt);
            score += 5;
          }

          idx = foundIdx + 1;
        }
      };

      // Search for full query first
      if (query.length > 2) {
        findExcerpts(query);
      }

      // Then search for individual words
      words.forEach(word => {
        if (word.length > 2) {
          findExcerpts(word);
        }
      });

      // Limit excerpts to 3
      const limitedExcerpts = excerpts.slice(0, 3);

      // Default excerpt if no match found but still has score from title/section
      if (score > 0 && limitedExcerpts.length === 0) {
        limitedExcerpts.push(doc.content.slice(0, 100) + '...');
      }

      return { ...doc, score, excerpts: limitedExcerpts };
    })
    .filter(r => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 6);

    return results;
  }, [searchQuery]);

  // Helper to highlight search terms in text
  const highlightText = (text: string, query: string) => {
    if (!query.trim()) return text;
    const words = query.toLowerCase().split(/\s+/).filter(w => w.length > 1);
    const allTerms = query.length > 2 ? [query, ...words] : words;

    // Create regex pattern for all terms
    const pattern = allTerms.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
    if (!pattern) return text;

    const regex = new RegExp(`(${pattern})`, 'gi');
    const parts = text.split(regex);

    return parts.map((part, i) => {
      if (allTerms.some(term => part.toLowerCase() === term.toLowerCase())) {
        return <mark key={i} className="bg-yellow-500/40 text-white px-0.5 rounded">{part}</mark>;
      }
      return part;
    });
  };

  const handleSearchSelect = (href: string) => {
    const query = searchQuery;
    setSearchQuery('');
    setSearchFocused(false);
    // Pass search query as URL param for highlighting on destination page
    router.push(`${href}?highlight=${encodeURIComponent(query)}`);
  };

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

  // Handle scroll position for fade gradients
  const handleNavScroll = useCallback(() => {
    const nav = navRef.current;
    if (!nav) return;

    const { scrollTop: st, scrollHeight, clientHeight } = nav;
    // Calculate how far from top (0 = at top, 1 = scrolled enough to show full gradient)
    const topFade = Math.min(st / 50, 1); // Fade in over 50px of scroll
    // Calculate how far from bottom (0 = at bottom, 1 = not at bottom)
    const bottomFade = Math.min((scrollHeight - clientHeight - st) / 50, 1);

    setScrollTop(topFade);
    setScrollBottom(bottomFade);
  }, []);

  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;

    // Initial check
    handleNavScroll();

    nav.addEventListener('scroll', handleNavScroll);
    return () => nav.removeEventListener('scroll', handleNavScroll);
  }, [handleNavScroll]);

  return (
    <div className="min-h-screen relative flex flex-col">
      {/* Search Highlighter (handles URL param highlighting) */}
      <Suspense fallback={null}>
        <SearchHighlighter />
      </Suspense>

      {/* Background */}
      <div className="fixed inset-0 z-0">
        <PixelBlastBackground />
      </div>

      {/* Mobile Sidebar Toggle - floating button */}
      <button
        className="md:hidden fixed top-[88px] left-4 z-[60] p-2 bg-black/80 border border-white/20 rounded-lg text-white/80 hover:text-white hover:bg-black transition-colors backdrop-blur-sm"
        onClick={() => setSidebarOpen(!sidebarOpen)}
        aria-label="Toggle docs sidebar"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          {sidebarOpen ? (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          )}
        </svg>
      </button>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Content wrapper with sidebar */}
      <div className="flex-1 flex relative z-10">
        {/* Sidebar - fixed position for full height */}
        <aside
          className={`fixed top-20 md:top-24 left-0 bottom-0 w-80 md:w-96 z-50 transform transition-transform duration-200 ease-out md:translate-x-0 flex-shrink-0 ${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
          }`}
        >
        <LiquidGlassCard
          className="h-full flex flex-col !rounded-none"
          shadowIntensity="none"
          glowIntensity="sm"
          blurIntensity="xl"
        >
          {/* Search Bar - fixed at top */}
          <div className="pt-6 pb-4 px-4 relative flex-shrink-0">
            <div className="relative">
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search docs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setTimeout(() => setSearchFocused(false), 150)}
                className="w-full bg-white/5 border border-white/10 rounded-lg py-3 pl-11 pr-4 text-base text-white placeholder:text-white/40 focus:outline-none focus:border-white/30 focus:bg-white/10 transition-colors"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/60"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>

            {/* Search Results Dropdown */}
            {searchFocused && searchResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-black/95 border border-white/10 rounded-lg overflow-hidden shadow-xl z-50 max-h-[400px] overflow-y-auto">
                {searchResults.map((result) => (
                  <button
                    key={result.href}
                    onClick={() => handleSearchSelect(result.href)}
                    className="w-full px-4 py-3 text-left hover:bg-white/10 transition-colors border-b border-white/5 last:border-0"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-white text-base font-medium">{result.title}</span>
                      <span className="text-white/40 text-sm px-1.5 py-0.5 bg-white/5 rounded">{result.section}</span>
                    </div>
                    {result.excerpts && result.excerpts.length > 0 && (
                      <div className="space-y-1.5 mt-1">
                        {result.excerpts.map((excerpt, i) => (
                          <p key={i} className="text-white/50 text-sm leading-relaxed">
                            {highlightText(excerpt, searchQuery)}
                          </p>
                        ))}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}

            {/* No Results */}
            {searchFocused && searchQuery.trim() && searchResults.length === 0 && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-black/90 border border-white/10 rounded-lg p-4 shadow-xl z-50">
                <p className="text-white/50 text-base text-center">No results found</p>
              </div>
            )}
          </div>

          {/* Scrollable navigation area with fade indicators */}
          <div className="flex-1 relative overflow-hidden">
            {/* Top fade gradient - deeper shadow, fades based on scroll position */}
            <div
              className="absolute top-0 left-0 right-0 h-12 bg-gradient-to-b from-black via-black/60 to-transparent z-10 pointer-events-none transition-opacity duration-150"
              style={{ opacity: scrollTop }}
            />

            {/* Bottom fade gradient - deeper shadow, fades based on scroll position */}
            <div
              className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-black via-black/60 to-transparent z-10 pointer-events-none transition-opacity duration-150"
              style={{ opacity: scrollBottom }}
            />

            <nav ref={navRef} className="h-full overflow-y-auto px-4 py-2 pb-32">
              {navigation.map((item) => (
                <NavSection
                  key={item.href}
                  item={item}
                  pathname={pathname}
                />
              ))}
            </nav>
          </div>
        </LiquidGlassCard>
      </aside>

        {/* Main Content - offset by sidebar width on desktop */}
        <main className="flex-1 min-w-0 md:ml-96">
          <div className="max-w-4xl px-4 md:px-8 md:pl-24 md:pr-24 pb-24">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
