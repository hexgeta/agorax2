"use client";

import { PixelSpinner } from "@/components/ui/PixelSpinner";
import { LiquidGlassCard } from "@/components/ui/liquid-glass";
import dynamic from "next/dynamic";

const AppBackground = dynamic(() => import("@/components/AppBackground").then(mod => mod.AppBackground), {
    ssr: false,
});

export default function TestBGPage() {
    return (
        <div className="min-h-screen bg-transparent flex flex-col items-center justify-center p-8 space-y-12 relative z-10">
            <AppBackground />
            <div className="text-center space-y-4">
                <h1 className="text-white text-4xl font-bold tracking-tighter">PIXEL SPINNER TEST</h1>
                <p className="text-white/40">Testing the 3x3 trailing pixel animation</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full max-w-5xl">
                {/* Small Spinner */}
                <LiquidGlassCard className="flex flex-col items-center justify-center p-12 bg-zinc-900/50">
                    <PixelSpinner size={24} />
                    <p className="mt-6 text-white/30 text-xs">24px</p>
                </LiquidGlassCard>

                {/* Medium Spinner */}
                <LiquidGlassCard className="flex flex-col items-center justify-center p-12 bg-zinc-900/50">
                    <PixelSpinner size={48} />
                    <p className="mt-6 text-white/30 text-xs">48px</p>
                </LiquidGlassCard>

                {/* Large Spinner */}
                <LiquidGlassCard className="flex flex-col items-center justify-center p-12 bg-zinc-900/50">
                    <PixelSpinner size={96} />
                    <p className="mt-6 text-white/30 text-xs">96px</p>
                </LiquidGlassCard>
            </div>

            <div className="w-full max-w-5xl p-12 bg-white/5 rounded-2xl flex items-center justify-center">
                <div className="flex flex-col items-center space-y-8">
                    <PixelSpinner size={64} />
                    <div className="text-center">
                        <p className="text-white font-mono">LOADING SYSTEM...</p>
                        <div className="mt-2 w-48 h-1 bg-white/10 overflow-hidden rounded-full">
                            <div className="h-full bg-white w-1/3 animate-[shimmer_2s_infinite]"></div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
