import * as React from "react";
import { cn } from "@/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";

const liquidGlassVariants = cva(
    "relative border border-white/10 overflow-hidden transition-all duration-300 bg-black/10",
    {
        variants: {
            // Shadow depth beneath the card
            shadowIntensity: {
                none: "",           // No shadow
                xs: "shadow-sm",    // Very subtle shadow
                sm: "shadow",       // Small shadow
                md: "shadow-md",    // Medium shadow
                lg: "shadow-lg",    // Large shadow
                xl: "shadow-xl",    // Extra large shadow
            },
            // White glow effect around the card
            glowIntensity: {
                none: "",                                           // No glow
                sm: "shadow-[0_0_10px_rgba(255,255,255,0.03)]",     // Subtle glow (10px, 3% opacity)
                low: "shadow-[0_0_15px_rgba(255,255,255,0.05)]",    // Light glow (15px, 5% opacity)
                medium: "shadow-[0_0_30px_rgba(255,255,255,0.1)]",  // Moderate glow (30px, 10% opacity)
                high: "shadow-[0_0_50px_rgba(255,255,255,0.2)]",    // Strong glow (50px, 20% opacity)
            },
            // Backdrop blur - how much the background is blurred through the card
            blurIntensity: {
                none: "",                   // No blur (0px)
                xs: "backdrop-blur-[2px]",  // Extra small blur (2px)
                sm: "backdrop-blur-sm",     // Small blur (4px)
                md: "backdrop-blur-md",     // Medium blur (12px)
                lg: "backdrop-blur-lg",     // Large blur (16px)
                xl: "backdrop-blur-xl",     // Extra large blur (24px)
                "2xl": "backdrop-blur-2xl", // 2x large blur (40px)
                "3xl": "backdrop-blur-3xl", // 3x large blur (64px)
            },
        },
        defaultVariants: {
            shadowIntensity: "xs",
            glowIntensity: "sm",
            blurIntensity: "xs",
        },
    }
);

export interface LiquidGlassCardProps
    extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof liquidGlassVariants> {
    borderRadius?: string;
}

const LiquidGlassCard = React.forwardRef<HTMLDivElement, LiquidGlassCardProps>(
    ({ className, shadowIntensity, glowIntensity, blurIntensity, borderRadius = "16px", style, children, ...props }, ref) => {
        return (
            <div
                ref={ref}
                className={cn(liquidGlassVariants({ shadowIntensity, glowIntensity, blurIntensity, className }))}
                style={{ borderRadius, ...style }}
                {...props}
            >
                {children}
            </div>
        );
    }
);
LiquidGlassCard.displayName = "LiquidGlassCard";

export { LiquidGlassCard, liquidGlassVariants };
