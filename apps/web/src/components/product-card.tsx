'use client';
import { useRef, type CSSProperties, type KeyboardEvent } from 'react';
import type { CatalogProduct } from '@/lib/catalog';
import { formatMoney } from '@/lib/format';
import { Button } from './ui/button';

function pastelColor(name: string): string {
  const colors = ['#fce4ec','#f3e5f5','#e8eaf6','#e0f7fa','#e8f5e9','#fff3e0','#fce4ec','#f3e5f5','#e1f5fe','#f1f8e9'];
  let hash=0; for(let i=0;i<name.length;i++) hash=name.charCodeAt(i)+((hash<<5)-hash);
  return colors[Math.abs(hash)%colors.length];
}
export default function ProductCard({ product, selectedVariantId, onSelectVariant, onAdd }: { product: CatalogProduct; selectedVariantId?: string; onSelectVariant:(productId:string,variantId:string)=>void; onAdd:(product:CatalogProduct)=>void }) {
 const refs=useRef<Array<HTMLButtonElement|null>>([]);
 const onKey=(e:KeyboardEvent<HTMLButtonElement>,index:number)=>{if(!['ArrowDown','ArrowRight','ArrowUp','ArrowLeft'].includes(e.key))return;e.preventDefault();const delta=e.key==='ArrowDown'||e.key==='ArrowRight'?1:-1;const next=(index+delta+product.variants.length)%product.variants.length;const v=product.variants[next];onSelectVariant(product.id,v.variantId);refs.current[next]?.focus();};
 return <article className="card card--hoverable product-card"><div className="product-card__thumb" style={{'--thumb':pastelColor(product.name)} as CSSProperties}/><div className="card__body"><div className="product-card__head"><div><h2 className="section-title">{product.name}</h2><p className="text-muted text-sm">{product.description}</p></div></div><div className="variant-list" role="radiogroup" aria-label={`Chọn loại ${product.name}`}>{product.variants.map((v,i)=>{const checked=selectedVariantId===v.variantId;return <button ref={el=>{refs.current[i]=el}} key={v.variantId} type="button" className="variant" role="radio" aria-checked={checked} tabIndex={checked || (!selectedVariantId&&i===0)?0:-1} onClick={()=>onSelectVariant(product.id,v.variantId)} onKeyDown={e=>onKey(e,i)}><span><strong>{v.name}</strong><span className="mono text-muted truncate" title={v.variantId}> {v.variantId}</span></span><span className="price">{formatMoney({amount:v.price,currency:'VND'})}</span></button>})}</div></div><div className="card__footer"><Button block disabled={!selectedVariantId} onClick={()=>onAdd(product)}>Thêm vào giỏ</Button></div></article>;
}
