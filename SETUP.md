# QuickBundle - Panduan Setup

## Prasyarat
- Node.js v18+
- Akun Shopify Partner (gratis)
- Development Store di Shopify Partners

## Langkah 1: Daftar Shopify Partners
1. Buka https://partners.shopify.com/signup
2. Daftar akun gratis
3. Buat "Development Store" untuk testing

## Langkah 2: Buat App di Partner Dashboard
1. Login ke https://partners.shopify.com
2. Klik "Apps" > "Create app"
3. Pilih "Build app manually"
4. Catat CLIENT_ID dan CLIENT_SECRET

## Langkah 3: Setup Project

```powershell
cd "D:\HIJAB Malaysia\Apps\shopify-bundle-app"

# Install dependencies
npm install

# Copy file .env
copy .env.example .env
```

## Langkah 4: Isi file .env
Edit file `.env` dan isi:
```
SHOPIFY_API_KEY=your-client-id-dari-partner-dashboard
SHOPIFY_API_SECRET=your-client-secret-dari-partner-dashboard
SCOPES=read_products,write_products,read_orders,write_discounts,read_discounts
DATABASE_URL=file:./dev.db
```

## Langkah 5: Setup Database

```powershell
npm run setup
```

## Langkah 6: Jalankan App (Development)

```powershell
npm run dev
```

Shopify CLI akan otomatis:
- Membuat tunnel ngrok
- Mengupdate URL di Partner Dashboard
- Membuka browser untuk install ke dev store

## Fitur yang Sudah Dibangun

### Bundle Types
| Tipe | Deskripsi |
|------|-----------|
| Fixed Bundle | Gabung produk spesifik, diskon tetap |
| Mix & Match | Pelanggan pilih dari koleksi |
| BOGO | Beli 1 Gratis 1 |
| Free Gift | Hadiah gratis saat beli produk |
| Volume Discount | Makin banyak makin hemat |
| Cross-sell | Rekomendasi produk pelengkap |

### Admin UI
- Dashboard dengan statistik
- Kelola bundle (CRUD)
- Settings widget (posisi, warna, judul)
- Billing plans (Free/$9.99/$29.99/$99.99)

### App Extensions
- Admin block di halaman produk
- Shopify Function untuk diskon

## Struktur File
```
shopify-bundle-app/
├── app/
│   ├── routes/
│   │   ├── app._index.tsx       # Dashboard
│   │   ├── app.tsx              # Layout
│   │   ├── app.bundles._index.  # Daftar bundle
│   │   ├── app.bundles.new.tsx  # Buat bundle
│   │   ├── app.bundles.$id.tsx  # Edit bundle
│   │   ├── app.settings.tsx     # Settings widget
│   │   ├── app.billing.tsx      # Plans & billing
│   │   ├── api.products.tsx     # API produk
│   │   └── webhooks.tsx         # Webhook handler
│   ├── shopify.server.ts
│   └── db.server.ts
├── extensions/
│   ├── bundle-widget/           # Admin UI extension
│   └── bundle-discount/        # Shopify Function diskon
└── prisma/
    └── schema.prisma            # Database schema
```
