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

        {/* Main Content */}
        <div className="w-full px-2 md:px-8 mt-6">
          <div className="max-w-[1200px] mx-auto">
            <OpenPositionsTable isMarketplaceMode={true} />
          </div>
        </div>
      </main>
    </>
  );
}

