export interface CatalogFixture { id:string; name:string; description:string; category:string; imagePath:string; imageAlt:string; displayOrder:number; variants: readonly {id:string;sku:string;displayName:string;listPrice:bigint}[] }
export const catalogFixtures: readonly CatalogFixture[] = [
  { id: 'prod-serum', name: 'Serum Dưỡng Ẩm', description: 'Sản phẩm chăm sóc cá nhân dịu nhẹ dùng hằng ngày.', category: 'serum', imagePath: '/products/prod-serum.svg', imageAlt: 'Minh họa Serum Dưỡng Ẩm', displayOrder: 1, variants: [
    { id: 'SKU-SERUM-15', sku: 'SKU-SERUM-15', displayName: '15 ml', listPrice: 150000n },
    { id: 'SKU-SERUM-30', sku: 'SKU-SERUM-30', displayName: '30 ml', listPrice: 280000n },
  ] },
  { id: 'prod-spf50', name: 'Kem Chống Nắng SPF50+', description: 'Sản phẩm chăm sóc cá nhân dịu nhẹ dùng hằng ngày.', category: 'sunscreen', imagePath: '/products/prod-spf50.svg', imageAlt: 'Minh họa Kem Chống Nắng SPF50+', displayOrder: 2, variants: [
    { id: 'SKU-SPF50-50G', sku: 'SKU-SPF50-50G', displayName: '50 g', listPrice: 220000n },
    { id: 'SKU-SPF50-100G', sku: 'SKU-SPF50-100G', displayName: '100 g', listPrice: 390000n },
  ] },
  { id: 'prod-facewash', name: 'Sữa Rửa Mặt CeraVe', description: 'Sản phẩm chăm sóc cá nhân dịu nhẹ dùng hằng ngày.', category: 'cleansing', imagePath: '/products/prod-facewash.svg', imageAlt: 'Minh họa Sữa Rửa Mặt CeraVe', displayOrder: 3, variants: [
    { id: 'SKU-FACEWASH-100', sku: 'SKU-FACEWASH-100', displayName: '100 ml', listPrice: 95000n },
  ] },
  { id: 'prod-vitc', name: 'Tinh Chất Vitamin C', description: 'Sản phẩm chăm sóc cá nhân dịu nhẹ dùng hằng ngày.', category: 'serum', imagePath: '/products/prod-vitc.svg', imageAlt: 'Minh họa Tinh Chất Vitamin C', displayOrder: 4, variants: [
    { id: 'SKU-VITC-10ML', sku: 'SKU-VITC-10ML', displayName: '10 ml', listPrice: 180000n },
    { id: 'SKU-VITC-20ML', sku: 'SKU-VITC-20ML', displayName: '20 ml', listPrice: 340000n },
  ] },
  { id: 'prod-toner', name: 'Toner Cấp Ẩm', description: 'Sản phẩm chăm sóc cá nhân dịu nhẹ dùng hằng ngày.', category: 'toner', imagePath: '/products/prod-toner.svg', imageAlt: 'Minh họa Toner Cấp Ẩm', displayOrder: 5, variants: [
    { id: 'SKU-TONER-150ML', sku: 'SKU-TONER-150ML', displayName: '150 ml', listPrice: 165000n },
    { id: 'SKU-TONER-250ML', sku: 'SKU-TONER-250ML', displayName: '250 ml', listPrice: 245000n },
  ] },
  { id: 'prod-micellar', name: 'Nước Tẩy Trang Dịu Nhẹ', description: 'Sản phẩm chăm sóc cá nhân dịu nhẹ dùng hằng ngày.', category: 'cleansing', imagePath: '/products/prod-micellar.svg', imageAlt: 'Minh họa Nước Tẩy Trang Dịu Nhẹ', displayOrder: 6, variants: [
    { id: 'SKU-MICELLAR-100ML', sku: 'SKU-MICELLAR-100ML', displayName: '100 ml', listPrice: 89000n },
    { id: 'SKU-MICELLAR-400ML', sku: 'SKU-MICELLAR-400ML', displayName: '400 ml', listPrice: 229000n },
  ] },
  { id: 'prod-cleansing-oil', name: 'Dầu Tẩy Trang', description: 'Sản phẩm chăm sóc cá nhân dịu nhẹ dùng hằng ngày.', category: 'cleansing', imagePath: '/products/prod-cleansing-oil.svg', imageAlt: 'Minh họa Dầu Tẩy Trang', displayOrder: 7, variants: [
    { id: 'SKU-OIL-100ML', sku: 'SKU-OIL-100ML', displayName: '100 ml', listPrice: 195000n },
    { id: 'SKU-OIL-200ML', sku: 'SKU-OIL-200ML', displayName: '200 ml', listPrice: 325000n },
  ] },
  { id: 'prod-ceramide', name: 'Kem Dưỡng Ceramide', description: 'Sản phẩm chăm sóc cá nhân dịu nhẹ dùng hằng ngày.', category: 'moisturizer', imagePath: '/products/prod-ceramide.svg', imageAlt: 'Minh họa Kem Dưỡng Ceramide', displayOrder: 8, variants: [
    { id: 'SKU-CERAMIDE-30G', sku: 'SKU-CERAMIDE-30G', displayName: '30 g', listPrice: 185000n },
    { id: 'SKU-CERAMIDE-50G', sku: 'SKU-CERAMIDE-50G', displayName: '50 g', listPrice: 275000n },
  ] },
  { id: 'prod-niacinamide', name: 'Serum Niacinamide', description: 'Sản phẩm chăm sóc cá nhân dịu nhẹ dùng hằng ngày.', category: 'serum', imagePath: '/products/prod-niacinamide.svg', imageAlt: 'Minh họa Serum Niacinamide', displayOrder: 9, variants: [
    { id: 'SKU-NIACINAMIDE-15ML', sku: 'SKU-NIACINAMIDE-15ML', displayName: '15 ml', listPrice: 145000n },
    { id: 'SKU-NIACINAMIDE-30ML', sku: 'SKU-NIACINAMIDE-30ML', displayName: '30 ml', listPrice: 265000n },
  ] },
  { id: 'prod-retinol', name: 'Serum Retinol Dịu Nhẹ', description: 'Sản phẩm chăm sóc cá nhân dịu nhẹ dùng hằng ngày.', category: 'serum', imagePath: '/products/prod-retinol.svg', imageAlt: 'Minh họa Serum Retinol Dịu Nhẹ', displayOrder: 10, variants: [
    { id: 'SKU-RETINOL-30ML', sku: 'SKU-RETINOL-30ML', displayName: '30 ml', listPrice: 320000n },
  ] },
  { id: 'prod-lip-balm', name: 'Son Dưỡng Môi', description: 'Sản phẩm chăm sóc cá nhân dịu nhẹ dùng hằng ngày.', category: 'lips', imagePath: '/products/prod-lip-balm.svg', imageAlt: 'Minh họa Son Dưỡng Môi', displayOrder: 11, variants: [
    { id: 'SKU-LIP-CLEAR', sku: 'SKU-LIP-CLEAR', displayName: 'Không màu', listPrice: 75000n },
    { id: 'SKU-LIP-PINK', sku: 'SKU-LIP-PINK', displayName: 'Hồng', listPrice: 85000n },
  ] },
  { id: 'prod-body-lotion', name: 'Sữa Dưỡng Thể', description: 'Sản phẩm chăm sóc cá nhân dịu nhẹ dùng hằng ngày.', category: 'body', imagePath: '/products/prod-body-lotion.svg', imageAlt: 'Minh họa Sữa Dưỡng Thể', displayOrder: 12, variants: [
    { id: 'SKU-BODY-250ML', sku: 'SKU-BODY-250ML', displayName: '250 ml', listPrice: 175000n },
    { id: 'SKU-BODY-400ML', sku: 'SKU-BODY-400ML', displayName: '400 ml', listPrice: 255000n },
  ] },
  { id: 'prod-hand-cream', name: 'Kem Dưỡng Tay', description: 'Sản phẩm chăm sóc cá nhân dịu nhẹ dùng hằng ngày.', category: 'body', imagePath: '/products/prod-hand-cream.svg', imageAlt: 'Minh họa Kem Dưỡng Tay', displayOrder: 13, variants: [
    { id: 'SKU-HAND-50G', sku: 'SKU-HAND-50G', displayName: '50 g', listPrice: 65000n },
  ] },
  { id: 'prod-mask', name: 'Mặt Nạ Cấp Ẩm', description: 'Sản phẩm chăm sóc cá nhân dịu nhẹ dùng hằng ngày.', category: 'mask', imagePath: '/products/prod-mask.svg', imageAlt: 'Minh họa Mặt Nạ Cấp Ẩm', displayOrder: 14, variants: [
    { id: 'SKU-MASK-1', sku: 'SKU-MASK-1', displayName: '1 miếng', listPrice: 25000n },
    { id: 'SKU-MASK-5', sku: 'SKU-MASK-5', displayName: 'Hộp 5 miếng', listPrice: 115000n },
  ] },
  { id: 'prod-shampoo', name: 'Dầu Gội Dịu Nhẹ', description: 'Sản phẩm chăm sóc cá nhân dịu nhẹ dùng hằng ngày.', category: 'hair', imagePath: '/products/prod-shampoo.svg', imageAlt: 'Minh họa Dầu Gội Dịu Nhẹ', displayOrder: 15, variants: [
    { id: 'SKU-SHAMPOO-300ML', sku: 'SKU-SHAMPOO-300ML', displayName: '300 ml', listPrice: 185000n },
  ] },
  { id: 'prod-conditioner', name: 'Dầu Xả Dưỡng Ẩm', description: 'Sản phẩm chăm sóc cá nhân dịu nhẹ dùng hằng ngày.', category: 'hair', imagePath: '/products/prod-conditioner.svg', imageAlt: 'Minh họa Dầu Xả Dưỡng Ẩm', displayOrder: 16, variants: [
    { id: 'SKU-CONDITIONER-250ML', sku: 'SKU-CONDITIONER-250ML', displayName: '250 ml', listPrice: 175000n },
  ] },
];
export const lotFixtures = catalogFixtures.flatMap((p) => p.variants.map((v, i) => ({ id: `inv-${v.sku.toLowerCase()}`, variantId:v.id, lotCode: v.id.startsWith('SKU-SERUM-15')?'LOT-001':v.id.startsWith('SKU-SERUM-30')?'LOT-002':v.id.startsWith('SKU-SPF50-50G')?'LOT-003':v.id.startsWith('SKU-SPF50-100G')?'LOT-004':v.id.startsWith('SKU-FACEWASH')?'LOT-005':v.id==='SKU-VITC-10ML'?'LOT-006':v.id==='SKU-VITC-20ML'?'LOT-007':`LOT-${v.sku.replace('SKU-','')}`, onHand:v.id==='SKU-VITC-10ML'?0:v.id==='SKU-SPF50-100G'?5:20+((p.displayOrder*7+i*11)%81) })));
