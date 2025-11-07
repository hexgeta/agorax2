import { cn } from '@/lib/utils'

interface FontLoaderProps {
  weight?: 'regular' | 'bold'
  priority?: boolean
}

export function FontLoader({ 
  weight = 'regular',
  priority = false 
}: FontLoaderProps) {
  const fontPath = `/fonts/Archia/Persephone NF Regular.ttf`
  
  return (
    <link
      rel="preload"
      href={fontPath}
      as="font"
      type="font/ttf"
      crossOrigin="anonymous"
    />
  )
} 