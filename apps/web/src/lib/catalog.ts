export interface CatalogVariant {
  variantId: string;
  name: string;
  price: string;
}

export interface CatalogProduct {
  id: string;
  name: string;
  description: string;
  variants: CatalogVariant[];
}

export const PRODUCTS: CatalogProduct[] = [
  { id: 'prod-1', name: 'Serum Dưỡng Ẩm', description: 'Giữ ẩm sâu, phục hồi da ban đêm', variants: [
    { variantId: 'SKU-SERUM-15', name: '15ml', price: '150000' },
    { variantId: 'SKU-SERUM-30', name: '30ml', price: '280000' },
  ] },
  { id: 'prod-2', name: 'Kem Chống Nắng SPF50+', description: 'Bảo vệ toàn diện khỏi tia UV', variants: [
    { variantId: 'SKU-SPF50-50G', name: '50g', price: '220000' },
    { variantId: 'SKU-SPF50-100G', name: '100g', price: '390000' },
  ] },
  { id: 'prod-3', name: 'Sữa Rửa Mặt CeraVe', description: 'Làm sạch nhẹ nhàng, không khô da', variants: [
    { variantId: 'SKU-FACEWASH-100', name: '100ml', price: '95000' },
  ] },
  { id: 'prod-4', name: 'Tinh Chất Vitamin C', description: 'Làm sáng da, giảm thâm nám', variants: [
    { variantId: 'SKU-VITC-10ML', name: '10ml', price: '180000' },
    { variantId: 'SKU-VITC-20ML', name: '20ml', price: '340000' },
  ] },
];
