# Screener AI — Dashboard Pantau Saham IDX

Dashboard saham Indonesia (Bursa Efek Indonesia / IDX): harga & alert,
analisa AI rule-based (bull/bear, saran masuk, scalping), Whale Detector,
dan logo per saham. Dibangun dengan **Astro** (output statis) + **Vercel
Serverless Functions** sebagai proxy Yahoo Finance. Tanpa API key.

## Struktur kode

```
vercel-dashboard/
├── astro.config.mjs          # build.format: 'file' -> URL sama seperti dulu
├── package.json              # scripts: dev / build / preview
├── vercel.json               # maxDuration 10s untuk api/*.js (framework auto-detect Astro)
├── api/
│   ├── quote.js              # Serverless Function: harga terakhir (Yahoo, CommonJS)
│   └── chart.js              # Serverless Function: data historis + volume (Yahoo, CommonJS)
├── public/
│   └── favicon.svg           # mark "S" oranye
├── src/
│   ├── layouts/
│   │   └── BaseLayout.astro  # <head>, auth guard, sidebar, topbar, slot konten
│   ├── components/
│   │   ├── Sidebar.astro     # menu Watchlist / Analisa AI / Whale / Alert / Portofolio
│   │   ├── Topbar.astro      # pencarian, Refresh, chip user, Logout
│   │   └── StockLogo.astro   # logo saham (pemakaian statis; JS pakai helper yang sama)
│   ├── pages/
│   │   ├── index.astro       # Watchlist + detail + alert + portofolio
│   │   ├── analisa.astro     # Analisa AI semua saham + boleh-masuk + scalping
│   │   ├── whale.astro       # Whale Detector (pindai 911 saham)
│   │   └── login.astro       # login password + ganti password (standalone)
│   ├── lib/
│   │   ├── ai.js             # analisa AI + format angka (fmtRp, RSI, MACD, ...)
│   │   ├── analysisPanel.js  # panel "Analisa AI" (dulu diduplikasi 2 halaman)
│   │   ├── whale.js          # skor Whale Detector
│   │   ├── tickers.js        # 911 emiten IDX (kode + nama)
│   │   ├── logos.js          # URL logo per saham + helper stockLogoHTML()
│   │   ├── auth.js           # login SHA-256 + guard + logout
│   │   └── menu.js           # hamburger mobile + tombol logout
│   └── styles/
│       └── global.css        # satu sistem desain (dulu diduplikasi di 3 halaman)
└── dist/                     # hasil `npm run build` (jangan di-commit)
```

Aturan yang dijaga saat migrasi dari HTML statis:

- **URL tidak berubah**: `index.html`, `analisa.html`, `whale.html`,
  `login.html` (Astro `build.format: 'file'`).
- **Semua ID yang dipakai JavaScript dipertahankan** (`#lastUpdate`,
  `#watchGrid`, `#topSearch`, `#btnAnalyzeAll`, `#aiPanel`, `#btnScan`, …).
- **Logika tidak diubah**: `ai.js`, `whale.js`, `auth.js`, `tickers.js`
  hanya diubah dari global `<script>` menjadi modul ESM (`export`).
- **`api/*.js` tidak disentuh** dan tetap CommonJS — karena itu
  `package.json` sengaja **tanpa** `"type": "module"`.
- **Desain tidak diubah**: sistem taste-skill yang sama (kartu putih,
  aksen oranye `#ff7a1a` / `#c2410c`, IBM Plex Sans, angka tabular).

## Logo per saham

- Sumber URL: katalog logo
  [ariefzzz5421/IDX-Stock-Terminal](https://github.com/ariefzzz5421/IDX-Stock-Terminal)
  (`public/idx-listed-catalog-20260930.csv` — logo dari TradingView
  `s3-symbol-logo`, Invezgo, dan situs emiten), dipangkas ke 911 emiten.
- **Cakupan: 908 dari 911 saham punya URL logo**; sisanya (XBGS, XCIS,
  XSPI — produk indeks/ETF tanpa logo emiten) memakai avatar inisial.
- Logo dipakai di kartu watchlist, dropdown pencarian, judul detail,
  tabel Analisa Semua / boleh-masuk / scalping, dan tabel Whale Detector.
- Bila gambar gagal dimuat, `onerror` menghapus `<img>` sehingga avatar
  inisial oranye di bawahnya yang tampil — tidak pernah ada gambar rusak.
- Clearbit Logo API sempat dipertimbangkan, tapi tidak bisa dijangkau dari
  VM ini (empty reply) dan katalog di atas lebih lengkap; sampel 8 URL
  sudah terverifikasi mengembalikan gambar asli (13 Nov 2026).

## Perintah

```bash
npm install
npm run dev      # http://localhost:4321
npm run build    # output ke dist/
npm run preview  # sajikan hasil build
```

## Deploy ke Vercel

Hubungkan repo ini sebagai proyek Vercel (import project). Vercel
mendeteksi Astro dari `package.json`, menjalankan `npm run build`, dan
menyajikan `dist/`; `api/*.js` tetap jadi Serverless Functions. Tidak
perlu adapter (`@astrojs/vercel` hanya untuk SSR — situs ini statis).

> Catatan: per 13 Nov 2026, deploy lewat konektor Muse masih terhalang
> otorisasi scope tim Vercel (403 pada scope
> `afrizalrafli27-7448s-projects`). Deploy langsung dengan
> `vercel deploy` dari CLI yang sudah login ke akun yang sama tidak
> memakai jalur konektor itu.

## Cara pakai

1. Buka URL hasil deploy, masuk dengan password (halaman login).
2. Watchlist awal: BBCA, BBRI, BMRI, BBNI, TLKM, ASII, GOTO, AMRT.
   Tambah/hapus kode saham lewat kolom tambah atau pencarian (911 emiten).
3. Klik sebuah saham untuk detail: grafik 1/3/6 bulan, MA20, MA50, RSI (14),
   tertinggi/terendah, dan panel Analisa AI — semuanya dihitung di browser
   dari data chart.
4. Tab **Alert**: buat alert harga tembus di atas/di bawah, atau perubahan
   % harian. Dicek setiap refresh (otomatis 60 detik + tombol refresh manual).
5. Tab **Portofolio**: tambah posisi manual (kode, lot, harga beli).
   Untung/rugi dihitung live dari harga terakhir.
6. Halaman **Analisa AI**: analisa semua saham watchlist sekaligus,
   daftar saham yang boleh masuk hari ini, dan yang cocok untuk scalping.
7. Halaman **Whale Detector**: pindai semua 911 saham IDX untuk jejak
   akumulasi/distribusi big money dari volume + harga.

## Sumber data & batasan

- Hanya Yahoo Finance, lewat `/api/quote` dan `/api/chart`. Tidak memakai
  API privat Stockbit, tidak ada harga live yang di-hardcode.
- Data bisa delay ~15 menit. Bukan rekomendasi investasi.
- Yahoo Finance adalah API publik tanpa kunci; bila Yahoo membatasi
  (rate limit / 429), dashboard menampilkan pesan error dan bisa dicoba
  lagi setelah beberapa saat.
- Login di sini pengunci sederhana (hash SHA-256 di kode, repo publik) —
  bukan keamanan sungguhan.
