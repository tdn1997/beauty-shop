export interface CatalogFixture {
  id: string;
  name: string;
  /** Tên cũ từng seed với cùng id — cho phép đổi tên mà không bị coi là va chạm id. */
  previousNames: readonly string[];
  description: string;
  category: string;
  imagePath: string;
  imageAlt: string;
  displayOrder: number;
  variants: readonly { id: string; sku: string; displayName: string; listPrice: bigint }[];
}
// Sản phẩm thật; ảnh từ Open Beauty Facts (CC BY-SA), xem apps/web/public/products/CREDITS.md.
export const catalogFixtures: readonly CatalogFixture[] = [
  {
    id: 'prod-serum',
    name: 'Serum Phục Hồi La Roche-Posay Hyalu B5',
    previousNames: ['Serum Dưỡng Ẩm'],
    description:
      'Hyaluronic acid kép cùng vitamin B5 và madecassoside giúp cấp ẩm, làm dịu và phục hồi hàng rào bảo vệ da. Dùng sáng và tối trước kem dưỡng.',
    category: 'serum',
    imagePath: '/products/prod-serum.jpg',
    imageAlt: 'Hộp serum La Roche-Posay Hyalu B5',
    displayOrder: 1,
    variants: [
      { id: 'SKU-SERUM-15', sku: 'SKU-SERUM-15', displayName: '15 ml', listPrice: 590000n },
      { id: 'SKU-SERUM-30', sku: 'SKU-SERUM-30', displayName: '30 ml', listPrice: 1050000n },
    ],
  },
  {
    id: 'prod-spf50',
    name: 'Sữa Chống Nắng La Roche-Posay Anthelios UVMune 400 SPF50+',
    previousNames: ['Kem Chống Nắng SPF50+'],
    description:
      'Màng lọc Mexoryl 400 chắn cả tia UVA dài, kết cấu sữa mỏng nhẹ, chống nước, phù hợp da nhạy cảm cho mặt và toàn thân.',
    category: 'sunscreen',
    imagePath: '/products/prod-spf50.jpg',
    imageAlt: 'Tuýp sữa chống nắng La Roche-Posay Anthelios UVMune 400',
    displayOrder: 2,
    variants: [
      { id: 'SKU-SPF50-50G', sku: 'SKU-SPF50-50G', displayName: '50 ml', listPrice: 495000n },
      { id: 'SKU-SPF50-100G', sku: 'SKU-SPF50-100G', displayName: '100 ml', listPrice: 790000n },
    ],
  },
  {
    id: 'prod-facewash',
    name: 'Sữa Rửa Mặt CeraVe Hydrating Facial Cleanser',
    previousNames: ['Sữa Rửa Mặt CeraVe'],
    description:
      'Làm sạch dịu nhẹ không tạo bọt với 3 ceramide thiết yếu và hyaluronic acid, giữ ẩm sau khi rửa. Dành cho da thường đến khô.',
    category: 'cleansing',
    imagePath: '/products/prod-facewash.jpg',
    imageAlt: 'Chai sữa rửa mặt CeraVe Hydrating Facial Cleanser',
    displayOrder: 3,
    variants: [
      { id: 'SKU-FACEWASH-100', sku: 'SKU-FACEWASH-100', displayName: '88 ml', listPrice: 190000n },
    ],
  },
  {
    id: 'prod-vitc',
    name: 'Serum Garnier Bright Complete Vitamin C Booster',
    previousNames: ['Tinh Chất Vitamin C'],
    description:
      'Phức hợp 4% niacinamide, vitamin Cg và salicylic acid giúp da sáng đều màu, mờ thâm sau 2 tuần. Kết cấu mỏng, thấm nhanh.',
    category: 'serum',
    imagePath: '/products/prod-vitc.jpg',
    imageAlt: 'Hộp và chai serum Garnier Vitamin C Booster',
    displayOrder: 4,
    variants: [
      { id: 'SKU-VITC-10ML', sku: 'SKU-VITC-10ML', displayName: '15 ml', listPrice: 179000n },
      { id: 'SKU-VITC-20ML', sku: 'SKU-VITC-20ML', displayName: '30 ml', listPrice: 299000n },
    ],
  },
  {
    id: 'prod-toner',
    name: 'Nước Hoa Hồng The Ordinary Glycolic Acid 7% Toning Solution',
    previousNames: ['Toner Cấp Ẩm'],
    description:
      'Toner tẩy tế bào chết hoá học với 7% glycolic acid, cải thiện bề mặt da sần và độ sáng. Dùng buổi tối, kết hợp chống nắng ban ngày.',
    category: 'toner',
    imagePath: '/products/prod-toner.jpg',
    imageAlt: 'Hộp nước hoa hồng The Ordinary Glycolic Acid 7%',
    displayOrder: 5,
    variants: [
      { id: 'SKU-TONER-150ML', sku: 'SKU-TONER-150ML', displayName: '100 ml', listPrice: 260000n },
      { id: 'SKU-TONER-250ML', sku: 'SKU-TONER-250ML', displayName: '240 ml', listPrice: 450000n },
    ],
  },
  {
    id: 'prod-micellar',
    name: 'Nước Tẩy Trang Garnier Micellar Cleansing Water',
    previousNames: ['Nước Tẩy Trang Dịu Nhẹ'],
    description:
      'Công nghệ micelle cuốn sạch lớp trang điểm, bụi bẩn và dầu thừa chỉ trong một bước, không cần rửa lại. Dịu nhẹ cho da nhạy cảm.',
    category: 'cleansing',
    imagePath: '/products/prod-micellar.jpg',
    imageAlt: 'Chai nước tẩy trang Garnier Micellar màu hồng',
    displayOrder: 6,
    variants: [
      {
        id: 'SKU-MICELLAR-100ML',
        sku: 'SKU-MICELLAR-100ML',
        displayName: '125 ml',
        listPrice: 89000n,
      },
      {
        id: 'SKU-MICELLAR-400ML',
        sku: 'SKU-MICELLAR-400ML',
        displayName: '400 ml',
        listPrice: 179000n,
      },
    ],
  },
  {
    id: 'prod-cleansing-oil',
    name: 'Dầu Tẩy Trang DHC Deep Cleansing Oil',
    previousNames: ['Dầu Tẩy Trang'],
    description:
      'Dầu ô liu nguyên chất hoà tan lớp trang điểm lâu trôi và bã nhờn trong lỗ chân lông, nhũ hoá khi gặp nước, rửa sạch không nhờn rít.',
    category: 'cleansing',
    imagePath: '/products/prod-cleansing-oil.jpg',
    imageAlt: 'Chai dầu tẩy trang DHC Deep Cleansing Oil',
    displayOrder: 7,
    variants: [
      { id: 'SKU-OIL-100ML', sku: 'SKU-OIL-100ML', displayName: '70 ml', listPrice: 245000n },
      { id: 'SKU-OIL-200ML', sku: 'SKU-OIL-200ML', displayName: '200 ml', listPrice: 520000n },
    ],
  },
  {
    id: 'prod-ceramide',
    name: 'Kem Dưỡng Ẩm CeraVe Moisturising Cream',
    previousNames: ['Kem Dưỡng Ceramide'],
    description:
      'Kem dưỡng đậm đặc với 3 ceramide, hyaluronic acid và công nghệ MVE giải phóng ẩm suốt 24 giờ. Dùng được cho cả mặt và toàn thân.',
    category: 'moisturizer',
    imagePath: '/products/prod-ceramide.jpg',
    imageAlt: 'Tuýp kem dưỡng ẩm CeraVe Moisturising Cream',
    displayOrder: 8,
    variants: [
      { id: 'SKU-CERAMIDE-30G', sku: 'SKU-CERAMIDE-30G', displayName: '50 ml', listPrice: 255000n },
      {
        id: 'SKU-CERAMIDE-50G',
        sku: 'SKU-CERAMIDE-50G',
        displayName: '177 ml',
        listPrice: 465000n,
      },
    ],
  },
  {
    id: 'prod-niacinamide',
    name: 'Serum The Ordinary Niacinamide 10% + Zinc 1%',
    previousNames: ['Serum Niacinamide'],
    description:
      'Niacinamide nồng độ cao kết hợp kẽm PCA giúp giảm bóng dầu, thu nhỏ lỗ chân lông và làm dịu vùng da mụn.',
    category: 'serum',
    imagePath: '/products/prod-niacinamide.jpg',
    imageAlt: 'Hộp serum The Ordinary Niacinamide 10% + Zinc 1%',
    displayOrder: 9,
    variants: [
      {
        id: 'SKU-NIACINAMIDE-15ML',
        sku: 'SKU-NIACINAMIDE-15ML',
        displayName: '30 ml',
        listPrice: 250000n,
      },
      {
        id: 'SKU-NIACINAMIDE-30ML',
        sku: 'SKU-NIACINAMIDE-30ML',
        displayName: '60 ml',
        listPrice: 420000n,
      },
    ],
  },
  {
    id: 'prod-retinol',
    name: 'Serum The Ordinary Retinol 1% in Squalane',
    previousNames: ['Serum Retinol Dịu Nhẹ'],
    description:
      'Retinol 1% trong nền squalane không nước giúp giảm nếp nhăn, cải thiện kết cấu da. Dành cho người đã quen retinol, dùng buổi tối.',
    category: 'serum',
    imagePath: '/products/prod-retinol.jpg',
    imageAlt: 'Chai serum The Ordinary Retinol 1% in Squalane',
    displayOrder: 10,
    variants: [
      { id: 'SKU-RETINOL-30ML', sku: 'SKU-RETINOL-30ML', displayName: '30 ml', listPrice: 290000n },
    ],
  },
  {
    id: 'prod-lip-balm',
    name: 'Son Dưỡng Môi NIVEA Original Care',
    previousNames: ['Son Dưỡng Môi'],
    description:
      'Bơ hạt mỡ và dầu jojoba hữu cơ dưỡng ẩm lâu dài, giữ môi mềm mịn. Có bản không màu và bản ánh hồng tự nhiên.',
    category: 'lips',
    imagePath: '/products/prod-lip-balm.jpg',
    imageAlt: 'Thỏi son dưỡng NIVEA Original Care',
    displayOrder: 11,
    variants: [
      { id: 'SKU-LIP-CLEAR', sku: 'SKU-LIP-CLEAR', displayName: 'Không màu', listPrice: 65000n },
      { id: 'SKU-LIP-PINK', sku: 'SKU-LIP-PINK', displayName: 'Ánh hồng', listPrice: 75000n },
    ],
  },
  {
    id: 'prod-body-lotion',
    name: 'Sữa Dưỡng Thể Vaseline Intensive Care Aloe Soothe',
    previousNames: ['Sữa Dưỡng Thể'],
    description:
      'Tinh chất lô hội và Vaseline Jelly vi mô cấp ẩm 48 giờ, thấm nhanh, làm dịu da khô sau khi đi nắng.',
    category: 'body',
    imagePath: '/products/prod-body-lotion.jpg',
    imageAlt: 'Chai sữa dưỡng thể Vaseline Aloe Soothe',
    displayOrder: 12,
    variants: [
      { id: 'SKU-BODY-250ML', sku: 'SKU-BODY-250ML', displayName: '200 ml', listPrice: 115000n },
      { id: 'SKU-BODY-400ML', sku: 'SKU-BODY-400ML', displayName: '400 ml', listPrice: 185000n },
    ],
  },
  {
    id: 'prod-hand-cream',
    name: 'Kem Dưỡng Tay Neutrogena Norwegian Formula',
    previousNames: ['Kem Dưỡng Tay'],
    description:
      'Công thức Na Uy đậm đặc với 40% glycerin, phục hồi da tay khô nứt chỉ sau một lần thoa, không nhờn dính.',
    category: 'body',
    imagePath: '/products/prod-hand-cream.jpg',
    imageAlt: 'Tuýp kem dưỡng tay Neutrogena Norwegian Formula',
    displayOrder: 13,
    variants: [
      { id: 'SKU-HAND-50G', sku: 'SKU-HAND-50G', displayName: '50 ml', listPrice: 115000n },
    ],
  },
  {
    id: 'prod-mask',
    name: 'Mặt Nạ Giấy Mizon Joyful Time Essence Mask Rose',
    previousNames: ['Mặt Nạ Cấp Ẩm'],
    description:
      'Tinh chất hoa hồng cấp ẩm, se khít lỗ chân lông và mang lại làn da mềm mướt, rạng rỡ sau 15–20 phút.',
    category: 'mask',
    imagePath: '/products/prod-mask.jpg',
    imageAlt: 'Gói mặt nạ giấy Mizon Joyful Time Rose',
    displayOrder: 14,
    variants: [
      { id: 'SKU-MASK-1', sku: 'SKU-MASK-1', displayName: '1 miếng', listPrice: 25000n },
      { id: 'SKU-MASK-5', sku: 'SKU-MASK-5', displayName: 'Hộp 5 miếng', listPrice: 115000n },
    ],
  },
  {
    id: 'prod-shampoo',
    name: 'Dầu Gội Dove Intensive Repair',
    previousNames: ['Dầu Gội Dịu Nhẹ'],
    description:
      'Công nghệ Keratin Repair Actives phục hồi tóc hư tổn từ sâu bên trong, giảm gãy rụng, cho tóc mềm mượt chắc khoẻ.',
    category: 'hair',
    imagePath: '/products/prod-shampoo.jpg',
    imageAlt: 'Chai dầu gội Dove Intensive Repair',
    displayOrder: 15,
    variants: [
      {
        id: 'SKU-SHAMPOO-300ML',
        sku: 'SKU-SHAMPOO-300ML',
        displayName: '340 g',
        listPrice: 135000n,
      },
    ],
  },
  {
    id: 'prod-conditioner',
    name: 'Dầu Xả Dove Nourishing Secrets Dừa',
    previousNames: ['Dầu Xả Dưỡng Ẩm'],
    description:
      'Tinh dầu dừa và nghệ nuôi dưỡng tóc khô xơ, gỡ rối dễ dàng, giữ tóc suôn mượt và thơm lâu.',
    category: 'hair',
    imagePath: '/products/prod-conditioner.jpg',
    imageAlt: 'Chai dầu xả Dove Nourishing Secrets chiết xuất dừa',
    displayOrder: 16,
    variants: [
      {
        id: 'SKU-CONDITIONER-250ML',
        sku: 'SKU-CONDITIONER-250ML',
        displayName: '320 g',
        listPrice: 125000n,
      },
    ],
  },
];
export const lotFixtures = catalogFixtures.flatMap((p) =>
  p.variants.map((v, i) => ({
    id: `inv-${v.sku.toLowerCase()}`,
    variantId: v.id,
    lotCode: v.id.startsWith('SKU-SERUM-15')
      ? 'LOT-001'
      : v.id.startsWith('SKU-SERUM-30')
        ? 'LOT-002'
        : v.id.startsWith('SKU-SPF50-50G')
          ? 'LOT-003'
          : v.id.startsWith('SKU-SPF50-100G')
            ? 'LOT-004'
            : v.id.startsWith('SKU-FACEWASH')
              ? 'LOT-005'
              : v.id === 'SKU-VITC-10ML'
                ? 'LOT-006'
                : v.id === 'SKU-VITC-20ML'
                  ? 'LOT-007'
                  : `LOT-${v.sku.replace('SKU-', '')}`,
    onHand:
      v.id === 'SKU-VITC-10ML'
        ? 0
        : v.id === 'SKU-SPF50-100G'
          ? 5
          : 20 + ((p.displayOrder * 7 + i * 11) % 81),
  })),
);
