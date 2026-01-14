'use client';

import Link from 'next/link';

// Cache the current year to avoid recalculating it on every render
const CURRENT_YEAR = new Date().getFullYear();

const Footer = () => {
  return (
    <footer className="w-full bg-black bg-blur-[1.65px] px-4 md:px-8 py-8 pb-12 md:pb-8 border-t border-white/20 relative z-[100]">
      <div className="max-w-[1200px] mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Main Info Column */}
          <div>
            <h3 className="text-s font-semibold mb-2 text-white">
              AgoráX {CURRENT_YEAR}
            </h3>
            <p className="text-sm text-white/70">
              Powering limit orders on PulseChain
            </p>
          </div>

                    {/* Explore */}
          <div>
            <h4 className="text-s font-semibold mb-2 text-white">
              Explore
            </h4>
            <ul className="space-y-1">
              <li>
                <Link
                  href="/"
                  className="text-sm text-white/70 hover:text-white transition-colors"
                >
                  My orders
                </Link>
              </li>
                                          <li>
                <Link
                  href="/marketplace"
                  className="text-sm text-white/70 hover:text-white transition-colors"
                >
                  Marketplace
                </Link>
              </li>
                            <li>
                <Link
                  href="https://x.com/agoraxwin"
                  className="text-sm text-white/70 hover:text-white transition-colors"
                >
                  Twitter
                </Link>
              </li>
            </ul>
          </div>

          {/* Legal Column */}
          <div>
            <h4 className="text-s font-semibold mb-2 text-white">
              Legal
            </h4>
            <ul className="space-y-1">
              <li>
                <Link
                  href="/privacy-policy"
                  className="text-sm text-white/70 hover:text-white transition-colors"
                >
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link
                  href="/terms-and-conditions"
                  className="text-sm text-white/70 hover:text-white transition-colors"
                >
                  Terms and Conditions
                </Link>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
