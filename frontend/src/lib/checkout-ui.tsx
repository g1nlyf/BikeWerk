import React, { createContext, useContext, useState, ReactNode, useCallback } from 'react';

export type CheckoutBike = {
  id: string;
  price: number;
  model: string;
  brand?: string;
  image?: string;
  title?: string;
  priceEur?: number;
  priceRub?: number;
  status?: "new" | "used" | "available" | "order";
};

type State = {
  buybackOpen: boolean;
  selectionOpen: boolean;
  bike: CheckoutBike | null;
};

interface CheckoutUIContextType {
  state: State;
  openBuyback: (bike?: CheckoutBike) => void;
  openSelection: () => void;
  closeAll: () => void;
  // Aliases for backward compatibility
  isBuybackOpen: boolean;
  closeBuyback: () => void;
}

const CheckoutUIContext = createContext<CheckoutUIContextType | undefined>(undefined);

export const CheckoutUIProvider = ({ children }: { children: ReactNode }) => {
  const [state, setState] = useState<State>({
    buybackOpen: false,
    selectionOpen: false,
    bike: null
  });

  const openBuyback = useCallback((bike?: CheckoutBike) => {
    setState({ buybackOpen: true, selectionOpen: false, bike: bike || null });
  }, []);

  const openSelection = useCallback(() => {
    setState(prev => ({ ...prev, buybackOpen: false, selectionOpen: true }));
  }, []);

  const closeAll = useCallback(() => {
    setState({ buybackOpen: false, selectionOpen: false, bike: null });
  }, []);

  // Alias for backward compatibility
  const closeBuyback = closeAll;

  return (
    <CheckoutUIContext.Provider value={{ 
      state, 
      openBuyback, 
      openSelection, 
      closeAll,
      isBuybackOpen: state.buybackOpen,
      closeBuyback
    }}>
      {children}
    </CheckoutUIContext.Provider>
  );
};

export const useCheckoutUI = () => {
  const context = useContext(CheckoutUIContext);
  if (context === undefined) {
    throw new Error('useCheckoutUI must be used within a CheckoutUIProvider');
  }
  return context;
};
