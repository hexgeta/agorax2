import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="text-8xl font-bold text-white mb-4">404</div>
        <h2 className="text-xl text-gray-300 mb-2">Page Not Found</h2>
        <p className="text-gray-500 text-sm mb-8">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <div className="flex gap-4 justify-center">
          <Link
            href="/"
            className="px-6 py-3 bg-white text-black font-medium rounded-full hover:bg-gray-200 transition-colors"
          >
            Go Home
          </Link>
          <Link
            href="/marketplace"
            className="px-6 py-3 border border-white/20 text-white font-medium rounded-full hover:bg-white/10 transition-colors"
          >
            Marketplace
          </Link>
        </div>
      </div>
    </div>
  );
}
