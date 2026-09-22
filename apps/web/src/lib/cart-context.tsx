'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

export interface CartItem {
  variantId: string;
  sku: string;
  name: string;
  price: string;
  quantity: number;
}

interface Cart {
  items: CartItem[];
  idempotencyKey: string;
}

interface CartContextValue {
  cart: Cart;
  addItem: (item: Omit<CartItem, 'quantity'>, quantity?: number) => void;
  removeItem: (variantId: string) => void;
  updateQuantity: (variantId: string, quantity: number) => void;
  clearCart: () => void;
  getIdempotencyKey: () => Promise<string>;
  totalItems: number;
}

const CART_STORAGE_KEY = 'beautyshop_cart';
const CartContext = createContext<CartContextValue | null>(null);

async function canonical(items: CartItem[]): Promise<string> {
  const data = items
    .map((i) => ({ variantId: i.variantId, quantity: i.quantity }))
    .sort((a, b) => a.variantId.localeCompare(b.variantId));
  return JSON.stringify(data);
}

function loadCart(): Cart {
  if (typeof window === 'undefined') return { items: [], idempotencyKey: '' };
  try {
    const raw = sessionStorage.getItem(CART_STORAGE_KEY);
    if (!raw) return { items: [], idempotencyKey: '' };
    return JSON.parse(raw) as Cart;
  } catch {
    return { items: [], idempotencyKey: '' };
  }
}

function saveCart(cart: Cart): void {
  try {
    sessionStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
  } catch {
    // storage unavailable
  }
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [cart, setCart] = useState<Cart>({ items: [], idempotencyKey: '' });
  const prevKeyRef = useRef<string>('');

  useEffect(() => {
    const loaded = loadCart();
    setCart(loaded);
    prevKeyRef.current = loaded.idempotencyKey;
  }, []);

  const refreshKey = useCallback(async (items: CartItem[]): Promise<string> => {
    const newKey = crypto.randomUUID();
    setCart((prev) => {
      const next = { items, idempotencyKey: newKey };
      saveCart(next);
      return next;
    });
    prevKeyRef.current = newKey;
    return newKey;
  }, []);

  const addItem = useCallback(
    (item: Omit<CartItem, 'quantity'>, quantity = 1) => {
      setCart((prev) => {
        const existing = prev.items.find((i) => i.variantId === item.variantId);
        let nextItems: CartItem[];
        if (existing) {
          nextItems = prev.items.map((i) =>
            i.variantId === item.variantId ? { ...i, quantity: i.quantity + quantity } : i,
          );
        } else {
          nextItems = [...prev.items, { ...item, quantity }];
        }
        const next = { ...prev, items: nextItems };
        saveCart(next);
        return next;
      });
    },
    [],
  );

  const removeItem = useCallback((variantId: string) => {
    setCart((prev) => {
      const nextItems = prev.items.filter((i) => i.variantId !== variantId);
      const next = { ...prev, items: nextItems };
      saveCart(next);
      return next;
    });
  }, []);

  const updateQuantity = useCallback((variantId: string, quantity: number) => {
    if (quantity <= 0) {
      setCart((prev) => {
        const nextItems = prev.items.filter((i) => i.variantId !== variantId);
        const next = { ...prev, items: nextItems };
        saveCart(next);
        return next;
      });
      return;
    }
    setCart((prev) => {
      const nextItems = prev.items.map((i) =>
        i.variantId === variantId ? { ...i, quantity } : i,
      );
      const next = { ...prev, items: nextItems };
      saveCart(next);
      return next;
    });
  }, []);

  const clearCart = useCallback(() => {
    const empty: Cart = { items: [], idempotencyKey: '' };
    setCart(empty);
    saveCart(empty);
    prevKeyRef.current = '';
  }, []);

  const getIdempotencyKey = useCallback(async (): Promise<string> => {
    const currentKey = prevKeyRef.current;
    const items = cart.items;
    const newKey = crypto.randomUUID();
    if (newKey !== currentKey) {
      await refreshKey(items);
    }
    return newKey;
  }, [cart.items, refreshKey]);

  const totalItems = useMemo(() => cart.items.reduce((sum, i) => sum + i.quantity, 0), [cart.items]);

  return (
    <CartContext.Provider value={{ cart, addItem, removeItem, updateQuantity, clearCart, getIdempotencyKey, totalItems }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used inside CartProvider');
  return ctx;
}
