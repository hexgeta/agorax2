'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';

// Use dynamic import with ssr: false to isolate the 3D library
const AppBackground = dynamic(
    () => import('@/components/AppBackground').then((mod) => mod.AppBackground),
    { ssr: false }
);

export default function TestBGPage() {
    return (
        <div className="relative min-h-screen">
            <AppBackground />

            <div className="relative z-10 flex flex-col items-center justify-center min-h-screen text-white bg-black/20">
                <h1 className="text-4xl font-bold mb-4">Shader Background Test Page</h1>
                <p className="mb-8 text-gray-300">
                    If you see a moving colored gradient, the background is working!
                </p>
                <Link
                    href="/"
                    className="px-6 py-2 bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg transition-colors"
                >
                    Return to Marketplace
                </Link>
            </div>
        </div>
    );
}
