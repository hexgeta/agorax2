"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";

const positions = [
    { x: 0, y: 0 }, // top-left
    { x: 1, y: 0 }, // top-center
    { x: 2, y: 0 }, // top-right
    { x: 2, y: 1 }, // mid-right
    { x: 2, y: 2 }, // bottom-right
    { x: 1, y: 2 }, // bottom-center
    { x: 0, y: 2 }, // bottom-left
    { x: 0, y: 1 }, // mid-left
];

export function PixelSpinner({ size = 24, className = "" }: { size?: number; className?: string }) {
    const [index, setIndex] = useState(0);

    useEffect(() => {
        const timer = setInterval(() => {
            setIndex((prev) => (prev + 1) % positions.length);
        }, 100);
        return () => clearInterval(timer);
    }, []);

    const cellSize = size / 3;

    return (
        <div
            className={`relative ${className}`}
            style={{ width: size, height: size }}
        >
            {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
                const pos = positions[i];
                const distance = (index - i + positions.length) % positions.length;

                // We want a trail, so we show the current one and the previous few
                const isActive = distance < 3;
                const opacity = isActive ? 1 - (distance * 0.3) : 0;
                const scale = isActive ? 1 - (distance * 0.1) : 0;

                return (
                    <motion.div
                        key={i}
                        className="absolute bg-white"
                        initial={false}
                        animate={{
                            opacity,
                            scale,
                            boxShadow: isActive ? "0 0 10px 2px rgba(255, 255, 255, 0.8)" : "none",
                        }}
                        transition={{ duration: 0.1 }}
                        style={{
                            width: cellSize,
                            height: cellSize,
                            left: pos.x * cellSize,
                            top: pos.y * cellSize,
                        }}
                    />
                );
            })}
        </div>
    );
}
