'use client';

import React, { useEffect, useRef } from 'react';

export function AppBackground() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const animationRef = useRef<number>();
    const offsetRef = useRef({ x: 0, y: 0 });

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Set canvas size
        const setSize = () => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        };
        setSize();

        // Animation loop
        const animate = () => {
            if (!ctx || !canvas) return;

            // Update offset for movement
            offsetRef.current.x += 0.5;
            offsetRef.current.y += 0.3;

            // Create noise texture
            const imageData = ctx.createImageData(canvas.width, canvas.height);
            const data = imageData.data;

            for (let y = 0; y < canvas.height; y++) {
                for (let x = 0; x < canvas.width; x++) {
                    const i = (y * canvas.width + x) * 4;

                    // Create flowing noise pattern
                    const nx = (x + offsetRef.current.x) / 50;
                    const ny = (y + offsetRef.current.y) / 50;
                    const noise = (Math.sin(nx) + Math.cos(ny) + Math.random() * 0.5) * 127 + 128;

                    data[i] = noise;     // R
                    data[i + 1] = noise; // G
                    data[i + 2] = noise; // B
                    data[i + 3] = 40;    // Alpha
                }
            }

            ctx.putImageData(imageData, 0, 0);
            animationRef.current = requestAnimationFrame(animate);
        };

        animate();

        // Handle resize
        const handleResize = () => {
            setSize();
        };

        window.addEventListener('resize', handleResize);

        return () => {
            window.removeEventListener('resize', handleResize);
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current);
            }
        };
    }, []);

    return (
        <div className='fixed top-0 left-0 w-full h-full z-0 pointer-events-none overflow-hidden bg-black'>
            {/* Animated noise canvas */}
            <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />

            {/* Color gradient overlay */}
            <div
                className="absolute inset-0"
                style={{
                    background: 'radial-gradient(circle at 30% 40%, rgba(36, 40, 128, 0.4) 0%, rgba(141, 125, 202, 0.2) 40%, transparent 70%)',
                    animation: 'gradient-drift 15s ease-in-out infinite'
                }}
            />
        </div>
    );
}
