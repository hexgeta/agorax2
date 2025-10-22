'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';
import { ContractType } from '@/config/testing';

interface ContractContextType {
  activeContract: ContractType;
  setActiveContract: (contract: ContractType) => void;
  toggleContract: () => void;
}

const ContractContext = createContext<ContractContextType | undefined>(undefined);

export function ContractProvider({ children }: { children: ReactNode }) {
  const [activeContract, setActiveContract] = useState<ContractType>('BISTRO');

  const toggleContract = () => {
    setActiveContract(prev => prev === 'BISTRO' ? 'AGORAX' : 'BISTRO');
  };

  return (
    <ContractContext.Provider value={{ activeContract, setActiveContract, toggleContract }}>
      {children}
    </ContractContext.Provider>
  );
}

export function useContract() {
  const context = useContext(ContractContext);
  if (context === undefined) {
    throw new Error('useContract must be used within a ContractProvider');
  }
  return context;
}

