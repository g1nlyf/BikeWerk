import * as React from 'react';
import { apiGet, apiPost, apiPut, apiDelete } from '@/api';
import { useAuth } from '@/lib/auth';
import { useCartUI } from '@/lib/cart-ui';

export type CartItem = {
  id: string; // usually bike_id for guests, or record id for api? API returns bike_id as well. Let's use bike_id as key.
  bike_id: number;
  name: string;
  brand: string;
  model: string;
  price: number;
  quantity: number;
  image?: string;
  url?: string;
  calculatedPrice?: number;
};

type CartContextType = {
  items: CartItem[];
  loading: boolean;
  addToCart: (item: Partial<CartItem> & { bike_id: number }) => Promise<void>;
  removeFromCart: (bikeId: number) => Promise<void>;
  updateQuantity: (bikeId: number, quantity: number) => Promise<void>;
  clearCart: () => Promise<void>;
  totalAmount: number;
  itemsCount: number;
};

const CartContext = React.createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { showNotification } = useCartUI();
  const [items, setItems] = React.useState<CartItem[]>([]);
  const [loading, setLoading] = React.useState(true);

  // Load cart on mount / user change
  React.useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      try {
        if (user) {
          // Sync local items if any
          const localStr = localStorage.getItem('guestCart');
          if (localStr) {
            try {
              const localItems: CartItem[] = JSON.parse(localStr);
              if (localItems.length > 0) {
                // Use batch sync endpoint
                const syncResponse = await apiPost('/cart/sync', { items: localItems.map(item => ({
                  bikeId: item.bike_id,
                  quantity: item.quantity,
                  calculatedPrice: item.calculatedPrice
                }))});
                
                if (syncResponse && syncResponse.success) {
                  localStorage.removeItem('guestCart');
                  // If sync returned updated cart, use it
                  if (syncResponse.cart) {
                    const mapped = (syncResponse.cart || []).map((i: any) => ({
                      id: String(i.id),
                      bike_id: i.bike_id,
                      name: i.name || i.bikes?.name,
                      brand: i.brand || i.bikes?.brand,
                      model: i.model || i.bikes?.model,
                      price: i.calculated_price || i.price || i.bikes?.price || 0,
                      quantity: i.quantity,
                      image: i.image || i.bikes?.main_image,
                      url: i.url || i.bikes?.url
                    }));
                    setItems(mapped);
                    // Skip the following fetch since we already have the cart
                    if (mounted) setLoading(false);
                    return;
                  }
                }
              }
            } catch (e) {
              console.error('Failed to sync local cart', e);
            }
          }

          // Fetch from API
          const res = await apiGet('/cart');
          if (mounted && res?.success) {
            // Map API response to CartItem
            const mapped = (res.cart || []).map((i: any) => ({
              id: String(i.id), // record id
              bike_id: i.bike_id,
              name: i.name || i.bikes?.name,
              brand: i.brand || i.bikes?.brand,
              model: i.model || i.bikes?.model,
              price: i.calculated_price || i.price || i.bikes?.price || 0,
              quantity: i.quantity,
              image: i.image || i.bikes?.main_image,
              url: i.url || i.bikes?.url
            }));
            setItems(mapped);
          }
        } else {
          // Load from LocalStorage
          const localStr = localStorage.getItem('guestCart');
          if (localStr && mounted) {
            setItems(JSON.parse(localStr));
          } else if (mounted) {
            setItems([]);
          }
        }
      } catch (err) {
        console.error('Load cart error:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => { mounted = false; };
  }, [user]);

  const saveLocal = (newItems: CartItem[]) => {
    localStorage.setItem('guestCart', JSON.stringify(newItems));
    setItems(newItems);
  };

  const addToCart = async (item: Partial<CartItem> & { bike_id: number }) => {
    // Optimistic Update
    const optimisticItem: CartItem = {
      id: String(item.bike_id),
      bike_id: item.bike_id,
      name: item.name || '',
      brand: item.brand || '',
      model: item.model || '',
      price: item.calculatedPrice || item.price || 0,
      quantity: item.quantity || 1,
      image: item.image,
      url: item.url,
      calculatedPrice: item.calculatedPrice || item.price || 0
    };

    if (user) {
      // Optimistically update state
      const existingIdx = items.findIndex(i => i.bike_id === item.bike_id);
      if (existingIdx >= 0) {
        setItems(prev => prev.map((i, idx) => idx === existingIdx ? { ...i, quantity: i.quantity + (item.quantity || 1) } : i));
      } else {
        setItems(prev => [...prev, optimisticItem]);
      }

      // API Call
      try {
        await apiPost('/cart', { 
          bikeId: item.bike_id, 
          quantity: item.quantity || 1, 
          calculatedPrice: item.calculatedPrice 
        });
        
        // Refresh to ensure sync
        const res = await apiGet('/cart');
        if (res?.success) {
           const mapped = (res.cart || []).map((i: any) => ({
              id: String(i.id),
              bike_id: i.bike_id,
              name: i.name || i.bikes?.name,
              brand: i.brand || i.bikes?.brand,
              model: i.model || i.bikes?.model,
              price: i.calculated_price || i.price || i.bikes?.price || 0,
              quantity: i.quantity,
              image: i.image || i.bikes?.main_image,
              url: i.url || i.bikes?.url
            }));
            setItems(mapped);
        }
      } catch (e) {
        console.error('Add to cart API error', e);
        // Rollback (re-fetch or revert) - simplified: re-fetch
        const res = await apiGet('/cart');
        if (res?.success) setItems((res.cart || []).map((i: any) => ({
              id: String(i.id),
              bike_id: i.bike_id,
              name: i.name || i.bikes?.name,
              brand: i.brand || i.bikes?.brand,
              model: i.model || i.bikes?.model,
              price: i.calculated_price || i.price || i.bikes?.price || 0,
              quantity: i.quantity,
              image: i.image || i.bikes?.main_image,
              url: i.url || i.bikes?.url
        })));
      }
    } else {
      // Local
      const existingIdx = items.findIndex(i => i.bike_id === item.bike_id);
      let newItems = [...items];
      if (existingIdx >= 0) {
        newItems[existingIdx].quantity += (item.quantity || 1);
      } else {
        newItems.push(optimisticItem);
      }
      saveLocal(newItems);
    }
    showNotification(item.image);
  };

  const removeFromCart = async (bikeId: number) => {
    // Optimistic
    const prevItems = items;
    setItems(prev => prev.filter(i => i.bike_id !== bikeId));

    if (user) {
      try {
        await apiDelete(`/cart/${bikeId}`);
      } catch (e) {
        // Rollback
        setItems(prevItems);
        console.error('Remove from cart error', e);
      }
    } else {
      const newItems = items.filter(i => i.bike_id !== bikeId);
      saveLocal(newItems);
    }
  };

  const updateQuantity = async (bikeId: number, quantity: number) => {
    if (quantity < 1) return removeFromCart(bikeId);
    
    const prevItems = items;
    setItems(prev => prev.map(i => i.bike_id === bikeId ? { ...i, quantity } : i));

    if (user) {
      try {
        await apiPut(`/cart/${bikeId}`, { quantity });
      } catch (e) {
        setItems(prevItems);
        console.error('Update quantity error', e);
      }
    } else {
      const newItems = items.map(i => i.bike_id === bikeId ? { ...i, quantity } : i);
      saveLocal(newItems);
    }
  };

  const clearCart = async () => {
    if (user) {
      // Ideally an endpoint for clearing, but we can loop delete or just rely on checkout clearing it.
      // For now, client side clear state.
      setItems([]);
    } else {
      saveLocal([]);
    }
  };

  const totalAmount = React.useMemo(() => items.reduce((acc, i) => acc + (i.price * i.quantity), 0), [items]);
  const itemsCount = React.useMemo(() => items.reduce((acc, i) => acc + i.quantity, 0), [items]);

  return (
    <CartContext.Provider value={{ items, loading, addToCart, removeFromCart, updateQuantity, clearCart, totalAmount, itemsCount }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = React.useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}