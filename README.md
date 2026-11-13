# Pantau Saham IDX — Dashboard Harga & Alert (Vercel-ready)

Dashboard statis + Vercel Serverless Functions untuk memantau saham Indonesia
(Bursa Efek Indonesia / IDX). Tanpa build step, tanpa framework, tanpa API key.

## Yang ada di sini

| File | Fungsi |
| --- | --- |
| `index.html` | Seluruh UI dashboard: strip IHSG, watchlist, detail saham + grafik canvas, alert, portofolio. Gaya terminal gelap, Bahasa Indonesia, responsif untuk HP. Watchlist, alert, dan portofolio tersimpan di `localStorage` browser. |
| `api/quote.js` | Serverless Function (Node). Proxy Yahoo Finance chart API untuk harga terakhir `.JK` dan `^JKSE`. CORS terbuka, cache 60 detik. |
| `api/chart.js` | Serverless Function (Node). Proxy data historis Yahoo Finance (`range=1mo/3mo/6mo`), mengembalikan `timestamps` + `closes` + `previousClose` untuk grafik dan indikator MA/RSI di sisi klien. |
| `vercel.json` | `framework: null` (tidak ada build), konfigurasi function `api/*.js` (`maxDuration: 10`). |

## Cara deploy ke Vercel

```bash
cd vercel-dashboard
vercel deploy
# untuk production:
vercel deploy --prod
```

Atau hubungkan folder ini sebagai proyek baru di dashboard Vercel (import project),
tanpa perintah build dan tanpa output directory — Vercel akan menyajikan
`index.html` sebagai situs statis dan `api/*.js` sebagai Serverless Functions.

> Catatan: per 13 Nov 2026, deploy lewat konektor Muse masih terhalang
> otorisasi scope tim Vercel (403 pada scope `afrizalrafli27-7448s-projects`).
> Deploy langsung dengan `vercel deploy` dari CLI yang sudah login ke akun
> yang sama tidak memakai jalur konektor itu.

## Cara pakai

1. Buka URL hasil deploy.
2. Watchlist awal: BBCA, BBRI, BMRI, BBNI, TLKM, ASII, GOTO, AMRT.
   Tambah/hapus kode saham lewat kolom tambah atau chip populer.
3. Klik sebuah saham untuk detail: grafik 1/3/6 bulan, MA20, MA50, RSI (14),
   tertinggi/terendah — semuanya dihitung di browser dari data chart.
4. Tab **Alert**: buat alert harga tembus di atas/di bawah, atau perubahan
   % harian. Dicek setiap refresh (otomatis 60 detik + tombol refresh manual).
   Alert yang terpicu masuk ke daftar "Alert yang terpicu"; aktifkan
   notifikasi browser lewat tombol 🔔 untuk menerima `Notification`.
5. Tab **Portofolio**: tambah posisi manual (kode, lot, harga beli).
   Untung/rugi dihitung live dari harga terakhir.

## Sumber data & batasan

- Hanya Yahoo Finance, lewat `/api/quote` dan `/api/chart`. Tidak memakai
  API privat Stockbit, tidak ada harga live yang di-hardcode.
- Data bisa delay ~15 menit. Bukan rekomendasi investasi.
- Yahoo Finance adalah API publik tanpa kunci; bila Yahoo membatasi
  (rate limit / 429), dashboard menampilkan pesan error dan bisa dicoba
  lagi setelah beberapa saat.
