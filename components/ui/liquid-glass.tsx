import * as React from "react";
import { cn } from "@/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";

const liquidGlassVariants = cva(
    "relative backdrop-blur-md border border-white/10 overflow-hidden transition-all duration-300",
    {
        variants: {
            shadowIntensity: {
                none: "",
                xs: "shadow-sm",
                sm: "shadow",
                md: "shadow-md",
                lg: "shadow-lg",
                xl: "shadow-xl",
            },
            glowIntensity: {
                none: "",
                low: "shadow-[0_0_15px_rgba(255,255,255,0.05)]",
                medium: "shadow-[0_0_30px_rgba(255,255,255,0.1)]",
                high: "shadow-[0_0_50px_rgba(255,255,255,0.2)]",
            },
        },
        defaultVariants: {
            shadowIntensity: "md",
            glowIntensity: "medium",
        },
    }
);

export interface LiquidGlassCardProps
    extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof liquidGlassVariants> {
    borderRadius?: string;
}

const LiquidGlassCard = React.forwardRef<HTMLDivElement, LiquidGlassCardProps>(
    ({ className, shadowIntensity, glowIntensity, borderRadius = "16px", style, children, ...props }, ref) => {
        return (
            <div
                ref={ref}
                className={cn(liquidGlassVariants({ shadowIntensity, glowIntensity, className }))}
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
