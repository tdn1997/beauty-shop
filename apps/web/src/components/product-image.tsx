'use client';
import Image from 'next/image';
import { useState } from 'react';
export default function ProductImage({ src, alt }: { src: string | null; alt: string }) {
  const [failed, setFailed] = useState(false);
  return (
    <div className="product-card__thumb">
      <Image
        src={!failed && src ? src : '/products/fallback.svg'}
        alt={alt}
        width={600}
        height={600}
        onError={() => setFailed(true)}
      />
    </div>
  );
}
