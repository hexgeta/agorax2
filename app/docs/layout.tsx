'use client';

import { useState, useEffect, useMemo, Suspense } from 'react';
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
  { title: 'Platform Comparison', href: '/docs/concepts/comparison', content: 'Compare AgoraX to other limit order and trading platforms on PulseChain and Ethereum. Side-by-side comparison with Matcha, 1inch, CoW Swap, UniswapX, PulseX, and 9inch. Fee comparison, feature matrix, MEV protection, slippage, partial fills, multi-token payments, oracle dependency, and contract immutability.', section: 'Core Concepts' },
  { title: 'Creating Orders', href: '/docs/guide/creating-orders', content: 'Step-by-step guide to creating limit orders. Select sell token and amount, choose accepted buy tokens, set your price above market, approve token spending, pay the listing fee, and confirm the transaction.', section: 'User Guide' },
  { title: 'Filling Orders', href: '/docs/guide/filling-orders', content: 'Browse the marketplace to find orders. Use filters for status, fill percentage, minimum USD, position relative to market. Select an order, choose payment token, enter fill amount, approve and confirm.', section: 'User Guide' },
  { title: 'Managing Orders', href: '/docs/guide/managing-orders', content: 'View all your orders in My Orders page. Claim proceeds from filled orders, cancel unfilled portions to reclaim tokens, track order status and fill history. Filter by active, expired, completed.', section: 'User Guide' },
  { title: 'Smart Contract', href: '/docs/technical/smart-contract', content: 'Technical reference for the AgoráX smart contract. Contract address 0xc8a47F14b1833310E2aC72e4C397b5b14a9FEf8B on PulseChain mainnet. Functions include createOrder, fillOrder, cancelOrder, claimProceeds.', section: 'Technical Reference' },
  { title: 'Data Structures', href: '/docs/technical/data-structures', content: 'TypeScript interfaces for order data. OrderDetails includes orderId, maker, sellToken, sellAmount, buyTokens, buyAmounts, expiration, isAllOrNothing. CompleteOrderDetails adds computed fields.', section: 'Technical Reference' },
  { title: 'API Reference', href: '/docs/technical/api', content: 'REST API v1 endpoints for integrating with AgoraX. GET /v1/stats for protocol statistics. GET /v1/leaderboard for rankings. GET /v1/users/{address} for user profiles. GET /v1/orders for order listings. GET /v1/orders/{orderId} for order details.', section: 'Technical Reference' },
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
      { title: 'Platform Comparison', href: '/docs/concepts/comparison' },
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
      { title: 'API Reference', href: '/docs/technical/api' },
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
    <div className="mb-4 md:mb-6">
      {/* Section header - not clickable, just a label */}
      <h4 className="text-xs md:text-base font-semibold text-white/30 uppercase tracking-wider px-3 mb-1 md:mb-2">
        {item.title}
      </h4>
      {/* Always show children */}
      {item.children && (
        <div className="space-y-0.5 md:space-y-1">
          {item.children.map((child) => (
            <Link
              key={child.href}
              href={child.href}
              className={`block text-sm md:text-lg py-1.5 md:py-2 px-3 rounded-md transition-colors ${
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

  // Close sidebar and scroll to top on route change
  useEffect(() => {
    setSidebarOpen(false);
    window.scrollTo(0, 0);
  }, [pathname]);

  // Prevent body scroll when sidebar is open on mobile (iOS-safe)
  useEffect(() => {
    if (sidebarOpen) {
      const scrollY = window.scrollY;
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.width = '100%';
    } else {
      const scrollY = document.body.style.top;
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
      if (scrollY) {
        window.scrollTo(0, parseInt(scrollY || '0') * -1);
      }
    }
    return () => {
      const scrollY = document.body.style.top;
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
      if (scrollY) {
        window.scrollTo(0, parseInt(scrollY || '0') * -1);
      }
    };
  }, [sidebarOpen]);

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

      {/* Mobile Sidebar Toggle - floating button (hidden when sidebar is open) */}
      {!sidebarOpen && (
        <LiquidGlassCard
          className="md:hidden fixed top-[88px] left-4 z-[60] cursor-pointer !bg-black/40"
          borderRadius="8px"
          shadowIntensity="none"
          glowIntensity="sm"
          blurIntensity="xl"
          onClick={() => setSidebarOpen(true)}
          role="button"
          aria-label="Open docs sidebar"
        >
          <div className="p-2 text-white/80 hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </LiquidGlassCard>
      )}

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar - outside z-10 wrapper so it renders above the overlay */}
      <aside
        className={`fixed top-20 md:top-24 left-0 bottom-0 w-72 md:w-96 z-50 transform transition-transform duration-200 ease-out md:translate-x-0 flex-shrink-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        <LiquidGlassCard
          className="h-full flex flex-col !rounded-l-none !rounded-r-2xl !overflow-y-auto"
          shadowIntensity="none"
          glowIntensity="sm"
          blurIntensity="xl"
        >
          {/* Close button + Search Bar - fixed at top */}
          <div className="pt-4 pb-4 px-4 relative flex-shrink-0">
            {/* Mobile close button */}
            <div className="flex justify-end mb-2 md:hidden">
              <button
                onClick={() => setSidebarOpen(false)}
                className="p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors"
                aria-label="Close sidebar"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
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
                className="w-full bg-white/5 border border-white/10 rounded-lg py-2 md:py-3 pl-11 pr-4 text-sm md:text-base text-white placeholder:text-white/40 focus:outline-none focus:border-white/30 focus:bg-white/10 transition-colors"
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

          {/* Scrollable navigation area */}
          <nav className="flex-1 overflow-y-auto px-4 py-2 pb-32 overscroll-contain" style={{ WebkitOverflowScrolling: 'touch' }}>
            {navigation.map((item) => (
              <NavSection
                key={item.href}
                item={item}
                pathname={pathname}
              />
            ))}
          </nav>
        </LiquidGlassCard>
      </aside>

      {/* Content wrapper */}
      <div className="flex-1 flex relative z-10">
        {/* Main Content - offset by sidebar width on desktop */}
        <main className="flex-1 min-w-0 md:ml-96">
          <div className="max-w-4xl px-4 md:px-8 md:pl-24 md:pr-24 pt-8 md:pt-12 pb-24">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
