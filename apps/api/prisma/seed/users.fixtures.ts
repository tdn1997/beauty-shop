export const userFixtures = [
 { id:'admin-demo', email:'admin@beautyshop.test', displayName:'Quản trị BeautyShop', role:'ADMIN' as const, passwordEnv:'SEED_ADMIN_PASSWORD', address:{id:'address-admin',recipientName:'Quản trị BeautyShop',phone:'0900000001',line1:'1 Nguyễn Huệ',line2:null,ward:'Bến Nghé',district:'Quận 1',province:'TPHCM'}},
 { id:'test-customer-1', email:'customer@beautyshop.test', displayName:'Nguyễn Văn A', role:'CUSTOMER' as const, passwordEnv:'SEED_CUSTOMER_PASSWORD', address:{id:'default',recipientName:'Nguyễn Văn A',phone:'0901234567',line1:'123 Đường Lê Lợi',line2:null,ward:'Phường Bến Nghé',district:'Quận 1',province:'TPHCM'}},
 { id:'test-customer-2', email:'customer2@beautyshop.test', displayName:'Trần Minh Anh', role:'CUSTOMER' as const, passwordEnv:'SEED_CUSTOMER2_PASSWORD', address:{id:'address-customer-2',recipientName:'Trần Minh Anh',phone:'0900000002',line1:'20 Bạch Đằng',line2:null,ward:'Hải Châu',district:'Hải Châu',province:'Đà Nẵng'}}
] as const;
