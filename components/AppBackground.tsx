'use client';

import React from 'react';

// Note: @shadergradient/react package has export issues on Vercel
// Temporarily disabled - using simple black background instead
export function AppBackground() {
    return <div className="fixed inset-0 bg-black z-0" />;
}
