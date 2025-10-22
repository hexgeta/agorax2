'use client';

import { useAccount, useSwitchChain } from 'wagmi';
import { ChevronDown } from 'lucide-react';
import Image from 'next/image';
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
      className="flex-[0.3] md:flex-none"
    >
      <DropdownMenu>
        <DropdownMenuTrigger className="flex items-center justify-center gap-2 md:gap-3 px-3 md:px-4 h-10 bg-black/40 border border-white/30 rounded-md hover:bg-white/10 transition-colors w-full md:w-[220px] focus:outline-none focus-visible:outline-none">
          <Image
            src={currentChain.icon}
            alt={currentChain.name}
            width={20}
            height={20}
            className="w-3 h-3 md:w-4 md:h-4"
          />
          <span className="text-white font-medium hidden md:inline">{currentChain.name}</span>
          <ChevronDown className="w-3 h-3 md:w-4 md:h-4 text-white/70" />
        </DropdownMenuTrigger>
        <DropdownMenuContent className="bg-black/95 border rounded-md border-white/10 backdrop-blur-sm z-[200] md:w-[220px]">
          {CHAINS.map((chainOption) => (
            <DropdownMenuItem
              key={chainOption.id}
              onClick={() => switchChain({ chainId: chainOption.id })}
              className="group flex items-center gap-2 md:gap-3 px-3 md:px-4 py-2 cursor-pointer text-white hover:text-black hover:bg-white data-[highlighted]:bg-white data-[highlighted]:text-black focus-visible:outline-none text-xs md:text-base transition-colors"
            >
              <Image
                src={chainOption.icon}
                alt={chainOption.name}
                width={20}
                height={20}
                className="w-3 h-3 md:w-4 md:h-4 group-hover:brightness-0 group-data-[highlighted]:brightness-0 transition-all"
              />
              <span className="hidden md:inline">{chainOption.name}</span>
              {chain?.id === chainOption.id && (
                <span className="ml-auto text-green-400">✓</span>
              )}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </motion.div>
  );
}

