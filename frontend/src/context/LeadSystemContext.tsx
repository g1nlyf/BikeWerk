import React, { createContext, useContext, useState, useCallback } from 'react';

interface Product {
    id: number;
    name: string;
    price: number;
    image: string;
    brand?: string;
    model?: string;
    category?: string;
}

interface LeadSystemContextType {
    isModalOpen: boolean;
    activeProduct: Product | null;
    mode: 'standard' | 'concierge';
    openLeadModal: (product: Product, mode?: 'standard' | 'concierge') => void;
    closeLeadModal: () => void;
}

const LeadSystemContext = createContext<LeadSystemContextType | undefined>(undefined);

export const LeadSystemProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [activeProduct, setActiveProduct] = useState<Product | null>(null);
    const [mode, setMode] = useState<'standard' | 'concierge'>('standard');

    const openLeadModal = useCallback((product: Product, mode: 'standard' | 'concierge' = 'standard') => {
        setActiveProduct(product);
        setMode(mode);
        setIsModalOpen(true);
    }, []);

    const closeLeadModal = useCallback(() => {
        setIsModalOpen(false);
        setActiveProduct(null);
        setMode('standard');
    }, []);

    return (
        <LeadSystemContext.Provider value={{ isModalOpen, activeProduct, mode, openLeadModal, closeLeadModal }}>
            {children}
        </LeadSystemContext.Provider>
    );
};

export const useLeadSystem = () => {
    const context = useContext(LeadSystemContext);
    if (context === undefined) {
        throw new Error('useLeadSystem must be used within a LeadSystemProvider');
    }
    return context;
};
