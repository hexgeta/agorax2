'use client';

import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';

// Dynamically import ShaderGradient components with ssr: false
const ShaderGradientCanvas = dynamic(
    () => import('@shadergradient/react').then((mod) => mod.ShaderGradientCanvas),
    { ssr: false }
);
const ShaderGradient = dynamic(
    () => import('@shadergradient/react').then((mod) => mod.ShaderGradient),
    { ssr: false }
);

export function AppBackground() {
    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
        setIsMounted(true);
    }, []);

    if (!isMounted) return <div className="fixed inset-0 bg-black z-0" />;

    return (
        <div className='fixed top-0 left-0 w-full h-full z-0 pointer-events-none'>
            <ShaderGradientCanvas
                style={{
                    width: '100%',
                    height: '100%',
                }}
                lazyLoad={undefined}
                fov={100}
                pixelDensity={1}
                pointerEvents="none"
            >
                <ShaderGradient
                    animate="on"
                    type="waterPlane"
                    wireframe={false}
                    shader="defaults"
                    uTime={8}
                    uSpeed={0.3}
                    uStrength={1.5}
                    uDensity={1.5}
                    uFrequency={0}
                    uAmplitude={0}
                    positionX={0}
                    positionY={0}
                    positionZ={0}
                    rotationX={50}
                    rotationY={0}
                    rotationZ={-60}
                    color1="#242880"
                    color2="#8d7dca"
                    color3="#212121"
                    reflection={0.1}

                    // View (camera) props
                    cAzimuthAngle={180}
                    cPolarAngle={80}
                    cDistance={2.8}
                    cameraZoom={9.1}

                    // Effect props
                    lightType="3d"
                    brightness={1}
                    envPreset="city"
                    grain="on"

                    // Tool props
                    toggleAxis={false}
                    zoomOut={false}
                    hoverState=""

                    // Optional - if using transition features
                    enableTransition={false}
                />
            </ShaderGradientCanvas>
        </div>
    );
}
