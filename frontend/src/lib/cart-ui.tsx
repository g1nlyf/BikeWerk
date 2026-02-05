import React, { createContext, useContext, useState, ReactNode } from 'react';

interface CartUIContextType {
  isCartOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
  toggleCart: () => void;
  showNotification: (message: string, type?: 'success' | 'error' | 'info') => void;
}

const CartUIContext = createContext<CartUIContextType | undefined>(undefined);

export const CartUIProvider = ({ children }: { children: ReactNode }) => {
  const [isCartOpen, setIsCartOpen] = useState(false);

  const openCart = () => setIsCartOpen(true);
  const closeCart = () => setIsCartOpen(false);
  const toggleCart = () => setIsCartOpen(prev => !prev);
  
  const showNotification = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    // Simple console log for now, can be replaced with toast
    console.log(`[${type.toUpperCase()}] ${message}`);
    // You could integrate sonner or toast here
  };

  return (
    <CartUIContext.Provider value={{ isCartOpen, openCart, closeCart, toggleCart, showNotification }}>
      {children}
    </CartUIContext.Provider>
  );
};

export const useCartUI = () => {
  const context = useContext(CartUIContext);
  if (context === undefined) {
    throw new Error('useCartUI must be used within a CartUIProvider');
  }
  return context;
};
