'use client';

import { useState, useEffect } from 'react';
import { DisclaimerDialog } from '@/components/DisclaimerDialog';
import { LogoPreloader } from '@/components/LogoPreloader';
import { OpenPositionsTable } from '@/components/OpenPositionsTable';

export default function MarketplacePage() {
  const [showDisclaimer, setShowDisclaimer] = useState(false);
  
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const accepted = localStorage.getItem('disclaimer-accepted');
      setShowDisclaimer(accepted !== 'true');
    }
  }, []);
  
  return (
    <>
      <DisclaimerDialog open={showDisclaimer} onAccept={() => setShowDisclaimer(false)} />
      <LogoPreloader />
      <main className="flex min-h-screen flex-col items-center">
        {/* Hero Section */}
        <div className="w-full px-2 md:px-8 mt-24 mb-0 bg-black">
          <div className="max-w-[1200px] mx-auto text-center">
            <h2 className="text-3xl md:text-5xl md:leading-[90px] font-bold text-white mb-0">
              Marketplace
            </h2>
            <p className="text-md md:text-xl text-gray-400 max-w-2xl mx-auto mb-6 mt-4 md:mt-0 flex items-center justify-center">
              Browse and execute available OTC deals
            </p>
          </div>
        </div>

        {/* Main Content */}
        <div className="w-full px-2 md:px-8 mt-2">
          <div className="max-w-[1200px] mx-auto">
            <OpenPositionsTable isMarketplaceMode={true} />
          </div>
        </div>
      </main>
    </>
  );
}

