'use client'

import PixelBlast from '@/components/PixelBlast'
import { useEffect, useState } from 'react'

export default function PixelBlastBackground() {
  const [shouldRender, setShouldRender] = useState(true)

  useEffect(() => {
    // Check for reduced motion preference
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    // Check hardware concurrency (CPU cores) - disable on devices with 4 or fewer cores
    const lowCPU = navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4

    // Check if mobile device
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)

    // Check device memory if available (Chrome only) - disable on devices with 4GB or less
    const lowMemory = (navigator as any).deviceMemory && (navigator as any).deviceMemory <= 4

    // Disable background if any low-performance indicators are present
    if (prefersReducedMotion || (isMobile && (lowCPU || lowMemory))) {
      setShouldRender(false)
    }
  }, [])

  if (!shouldRender) {
    return null
  }

  const opacity = 0.4 // Range: 0-1 - Overall opacity of the pixel effect

  return (
    <div style={{ width: '100%', height: '100%', position: 'fixed', top: 0, left: 0, zIndex: 0, pointerEvents: 'none', opacity }}>
      <PixelBlast
        variant="square" // Options: 'square' | 'circle' | 'triangle' | 'diamond'
        pixelSize={2} // Default: 3 - Size of individual pixels, no max limit
        color="#888" // Any valid hex/rgb color string
        patternScale={4} // Default: 2 - Scale of noise pattern, no max limit
        patternDensity={3} // Default: 1 - Density of visible pixels, no max limit
        pixelSizeJitter={0.5} // Range: 0-1 (default: 0) - Random size variation per pixel
        enableRipples // Boolean - Enable click ripple effects
        rippleSpeed={10} // Default: 0.3 - Speed of ripple expansion, no max limit
        speed={6} // Default: 0.5 - Animation speed multiplier, no max limit
        edgeFade={0.3} // Range: 0-1 (default: 0.5) - Fade at edges (0 = none, 1 = max)
        transparent // Boolean - Transparent background
      />
    </div>
  )
}
