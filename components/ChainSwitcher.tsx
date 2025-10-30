'use client';

import { useAccount, useSwitchChain } from 'wagmi';
import { ChevronDown } from 'lucide-react';
import { motion } from 'framer-motion';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { getAvailableChains } from '@/config/testing';

const CHAINS = getAvailableChains();

export function ChainSwitcher({ isCheckingConnection }: { isCheckingConnection: boolean }) {
  const { chain, isConnected } = useAccount();
  const { switchChain } = useSwitchChain();

  const currentChain = CHAINS.find((c) => c.id === chain?.id) || CHAINS[0];

  if (!isConnected || isCheckingConnection) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      <DropdownMenu>
        <DropdownMenuTrigger className="flex items-center justify-center gap-2 md:gap-3 px-3 md:px-4 h-12 bg-black/40 border border-[#00D9FF]/30 hover:bg-[#00D9FF]/10 transition-colors w-full md:w-[220px] rounded-none focus:outline-none focus-visible:outline-none">
          <div 
            className="w-3 h-3 md:w-4 md:h-4 relative"
            style={{ 
              WebkitMaskImage: `url(${currentChain.icon})`,
              WebkitMaskSize: 'contain',
              WebkitMaskRepeat: 'no-repeat',
              WebkitMaskPosition: 'center',
              maskImage: `url(${currentChain.icon})`,
              maskSize: 'contain',
              maskRepeat: 'no-repeat',
              maskPosition: 'center',
            }}
            aria-label={currentChain.name}
          >
            <div className="absolute inset-0 bg-[#00D9FF]" />
          </div>
          <span className="text-[#00D9FF] font-medium hidden md:inline">{currentChain.name}</span>
          <ChevronDown className="w-3 h-3 md:w-4 md:h-4 text-[#00D9FF]/70" />
        </DropdownMenuTrigger>
        <DropdownMenuContent className="bg-black/95 border border-[#00D9FF]/10 backdrop-blur-sm z-[200] w-full md:w-[220px] rounded-lg">
          {CHAINS.map((chainOption) => (
            <DropdownMenuItem
              key={chainOption.id}
              onClick={() => switchChain({ chainId: chainOption.id })}
              className="group flex items-center gap-2 md:gap-3 px-3 md:px-4 py-2 cursor-pointer text-[#00D9FF] hover:text-black hover:bg-[#00D9FF] data-[highlighted]:bg-[#00D9FF] data-[highlighted]:text-black focus-visible:outline-none text-xs md:text-base transition-colors"
            >
              <div 
                className="w-3 h-3 md:w-4 md:h-4 relative"
                style={{ 
                  WebkitMaskImage: `url(${chainOption.icon})`,
                  WebkitMaskSize: 'contain',
                  WebkitMaskRepeat: 'no-repeat',
                  WebkitMaskPosition: 'center',
                  maskImage: `url(${chainOption.icon})`,
                  maskSize: 'contain',
                  maskRepeat: 'no-repeat',
                  maskPosition: 'center',
                }}
                aria-label={chainOption.name}
              >
                <div className="absolute inset-0 bg-[#00D9FF] group-hover:bg-black group-data-[highlighted]:bg-black transition-colors" />
              </div>
              <span className="hidden md:inline">{chainOption.name}</span>
              {chain?.id === chainOption.id && (
                <span className="ml-auto text-[#FF00D9]">✓</span>
              )}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </motion.div>
  );
}

