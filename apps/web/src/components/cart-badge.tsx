'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useCart } from '@/lib/cart-context';
export default function CartBadge(){const{totalItems}=useCart();const[mounted,setMounted]=useState(false);useEffect(()=>setMounted(true),[]);const count=mounted?totalItems:0;return <Link className="cart-link" href="/cart" aria-label={`Giỏ hàng, ${count} sản phẩm`}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M3 3h2l2.4 11.3a2 2 0 0 0 2 1.7h7.8a2 2 0 0 0 2-1.6L21 7H6"/><circle cx="10" cy="20" r="1"/><circle cx="18" cy="20" r="1"/></svg><span className="cart-link-label">Giỏ hàng</span><span className="cart-count-slot">{count>0&&<span className="cart-link__count" aria-hidden="true">{count>99?'99+':count}</span>}</span></Link>}
