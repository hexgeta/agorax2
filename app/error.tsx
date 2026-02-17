'use client';

import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
  }, [error]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="text-6xl font-bold text-white mb-4">Oops</div>
        <h2 className="text-xl text-gray-300 mb-2">Something went wrong</h2>
        <p className="text-gray-500 text-sm mb-8">
          {error.message || 'An unexpected error occurred. Please try again.'}
        </p>
        <div className="flex gap-4 justify-center">
          <button
            onClick={reset}
            className="px-6 py-3 bg-white text-black font-medium rounded-full hover:bg-gray-200 transition-colors"
          >
            Try Again
          </button>
          <a
            href="/"
            className="px-6 py-3 border border-white/20 text-white font-medium rounded-full hover:bg-white/10 transition-colors"
          >
            Go Home
          </a>
        </div>
      </div>
    </div>
  );
}
