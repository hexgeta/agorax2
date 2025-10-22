'use client'

import Link from 'next/link';
import { ConnectButton } from './ConnectButton';
import { ChainSwitcher } from './ChainSwitcher';
import { TESTING_MODE, ContractType } from '@/config/testing';
import { useContract } from '@/context/ContractContext';
import { ChevronDown } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const CONTRACTS: { value: ContractType; label: string }[] = [
  { value: 'BISTRO', label: 'Bistro' },
  { value: 'AGORAX', label: 'AgoraX' },
];

const NavBar = () => {
  const { activeContract, setActiveContract } = useContract();

  return (
    <nav className="w-full bg-black/60 px-8 py-4 top-0 left-0 right-0 z-[100] border-b border-[rgba(255,255,255,0.2)]">
      <div className="max-w-[1200px] mx-auto flex items-center justify-between">
        <Link href="/" className="text-white font-bold text-xl md:text-3xl">
          AgoráX
        </Link>
        <div className="flex items-center gap-4">
          {TESTING_MODE && (
            <DropdownMenu>
              <DropdownMenuTrigger className="flex items-center justify-center gap-2 px-3 md:px-4 h-10 bg-purple-600/20 border border-purple-500/50 rounded-md hover:bg-purple-600/30 transition-colors w-[140px] focus:outline-none focus-visible:outline-none">
                <span className="text-purple-300 font-medium text-xs md:text-sm">
                  {CONTRACTS.find(c => c.value === activeContract)?.label}
                </span>
                <ChevronDown className="w-3 h-3 md:w-4 md:h-4 text-purple-300/70" />
              </DropdownMenuTrigger>
              <DropdownMenuContent className="bg-black/95 border rounded-md border-purple-500/30 backdrop-blur-sm z-[200] w-[140px]">
                {CONTRACTS.map((contract) => (
                  <DropdownMenuItem
                    key={contract.value}
                    onClick={() => setActiveContract(contract.value)}
                    className="group flex items-center justify-between px-3 md:px-4 py-2 cursor-pointer text-purple-300 hover:text-black hover:bg-purple-400 data-[highlighted]:bg-purple-400 data-[highlighted]:text-black focus-visible:outline-none text-xs md:text-sm transition-colors"
                  >
                    <span>{contract.label}</span>
                    {activeContract === contract.value && (
                      <span className="ml-auto text-green-400">✓</span>
                    )}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          <ChainSwitcher isCheckingConnection={false} />
          <ConnectButton />
        </div>
      </div>
    </nav>
  );
};

export default NavBar; 