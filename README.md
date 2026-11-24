# Lintas: simulator ekspor UMKM

Prototipe web-app untuk riset **"Pemodelan Sistem Dinamis untuk Optimasi Strategi Pemasaran Ekspor UMKM melalui Inovasi Produk dan Ekosistem Platform Digital"**.

Semua perhitungan (simulasi sistem dinamis, Monte Carlo, VaR/CVaR, dan optimasi alokasi) berjalan di browser, sehingga aplikasi bisa di-deploy sebagai situs statis di Vercel tanpa server.

## Fitur

| Halaman | Isi |
|---|---|
| Beranda | Scene 3D isometrik beranimasi: bengkel produksi, lab inovasi, hub platform digital, gudang & sertifikasi, pelabuhan ekspor. Klik bangunan untuk melihat perannya dalam model. |
| Simulator | Pilih komoditas, atur anggaran, alokasi, kurs, dan tarif. Simulasi 60 bulan diputar langsung di scene 3D (jumlah truk, kapal, paket data, dan kontainer mengikuti hasil model) beserta grafik dan KPI. |
| Optimasi & risiko | Optimasi alokasi anggaran pada simpleks dengan 3 sikap risiko (netral, seimbang mean–CVaR, robust CVaR 95%), histogram laba kumulatif, VaR, CVaR, dan peluang rugi. Hasil bisa diterapkan ke simulator. |
| Struktur model | Diagram sebab-akibat interaktif (loop R1, R2, B1, B2) dan persamaan inti. |

## Menjalankan di komputer

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # hasil di folder dist/
```

Butuh Node.js 20 atau lebih baru.

## Deploy ke Vercel

**Cara A, lewat GitHub (disarankan)**
1. Buat repositori baru di GitHub, lalu unggah isi folder ini (tanpa `node_modules` dan `dist`).
2. Di vercel.com, pilih **Add New → Project**, lalu impor repositori tersebut.
3. Vercel otomatis mengenali Vite. Pengaturan yang dipakai (sudah ada di `vercel.json`): Build Command `npm run build`, Output Directory `dist`.
4. Klik **Deploy**. Setiap `git push` berikutnya akan otomatis memperbarui situs.

**Cara B, lewat terminal**
```bash
npm i -g vercel
vercel          # ikuti pertanyaan login dan nama proyek
vercel --prod   # rilis ke domain produksi
```

## Struktur kode

```
src/
  model/sim.ts        model stock–flow, preset komoditas, Monte Carlo, VaR/CVaR
  model/optimize.ts   optimasi alokasi (pencarian acak + penyempurnaan lokal, common random numbers)
  scene/World.tsx     scene 3D (React Three Fiber)
  ui/                 panel antarmuka: simulator, optimasi, diagram struktur, grafik
  store.ts            state aplikasi (zustand)
```

## Kalibrasi

Parameter di `src/model/sim.ts` (array `COMMODITIES` dan konstanta di fungsi `simulate`) masih berupa nilai ilustratif. Pada tahap riset, ganti dengan hasil kalibrasi dari data UMKM mitra, BPS, dan Kemendag, lalu validasi lewat uji struktur, uji kondisi ekstrem, dan uji reproduksi perilaku.
