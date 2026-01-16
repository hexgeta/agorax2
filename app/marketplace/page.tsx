'use client';

import { useState, useEffect } from 'react';
import { DisclaimerDialog } from '@/components/DisclaimerDialog';
import { LogoPreloader } from '@/components/LogoPreloader';
import { OpenPositionsTable } from '@/components/OpenPositionsTable';
import PixelBlastBackground from '@/components/ui/PixelBlastBackground';

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
      <main className="flex min-h-screen flex-col items-center relative overflow-hidden">
        {/* Animated background effect */}
        <div className="fixed inset-0 z-0">
          <PixelBlastBackground />
        </div>

        {/* Main Content */}
        <div className="w-full px-2 md:px-8 mt-2 relative z-10">
          <div className="max-w-[1200px] mx-auto">
            <OpenPositionsTable isMarketplaceMode={true} />
          </div>
        </div>
      </main>
    </>
  );
}

