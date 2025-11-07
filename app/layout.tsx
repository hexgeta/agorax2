import '@/styles/global.css'
import { FontLoader } from '@/components/ui/FontLoader'
import NavBar from '@/components/NavBar'
import Footer from '@/components/Footer'
import { Providers } from '@/components/Providers'
import AppKitProvider from '@/context/AppKitProvider'
import { Toaster } from '@/components/ui/toaster'
import { headers } from 'next/headers'

// Static layout with revalidation
export const revalidate = 2592000; // 30 days in seconds

export const metadata = {
  title: 'AgoráX - The best place to trade on PulseChain.',
  description: 'AgoráX is a limit order DEX for trading tokens on PulseChain at the best rates. Low fees & no slippage.',
  metadataBase: new URL('https://agorax2.lookintomaxi.com'),
  openGraph: {
    title: 'AgoráX - Peer-to-peer Trading on PulseChain',
    description: 'AgoráX is a limit order DEX for trading tokens on PulseChain at the best rates. Low fees & no slippage.',
    url: 'https://agorax2.lookintomaxi.com',
    siteName: 'AgoráX',
    images: [
      {
        url: '/opengraph-image.png',
        width: 1200,
        height: 630,
        alt: 'AgoráX - Peer-to-peer Trading on PulseChain',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'AgoráX - Peer-to-peer Trading on PulseChain',
    description: 'AgoráX is a limit order DEX for trading tokens on PulseChain at the best rates. Low fees & no slippage.',
    images: ['/opengraph-image.png'],
  },
  icons: {
    icon: [
      {
        url: '/favicon.svg',
        type: 'image/svg+xml',
      }
    ],
    apple: [
      {
        url: '/favicon-apple.png',
        type: 'image/png',
      }
    ],
  },
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const headersData = await headers();
  const cookies = headersData.get('cookie');

  return (
    <html lang="en" className="font-sans">
      <head>
        <FontLoader weight="regular" priority={true} />
        <FontLoader weight="bold" />
        <script defer data-domain="agorax2.lookintomaxi.com" src="https://plausible.io/js/script.js"></script>
      </head>
      <body className="min-h-screen bg-black text-white">
        <AppKitProvider cookies={cookies}>
          <Providers>
            <div className="flex flex-col min-h-screen">
              <NavBar />
              <main className="flex-grow">{children}</main>
              <Footer />
            </div>
            <Toaster />
          </Providers>
        </AppKitProvider>
      </body>
    </html>
  )
}
