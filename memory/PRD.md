# HORAS BAJA – All-in-One POS & Management (PRD)

## Original Problem Statement
All-in-One Management & POS System untuk Toko Bahan Bangunan Spesialis Seng, Roofing & Material Konstruksi "HORAS BAJA" (Jln Ade Irma Suryani No 68, Pematang Siantar; Gudang Mojopahit & Wahidin). Web responsive + PWA offline-first, role Admin/Pemilik & Kasir, 6 modul: Master Data, POS (ready + indent builder, kalkulator meter, upah lengkung, ongkir, catatan, pembayaran, nota 80mm, surat jalan parsial), Riwayat Penjualan (dot status, filter, edit admin + tambah item, void), Pembelian (auto PO indent PREFIX+YY+0001, PO manual, status penerimaan kasir tanpa harga, edit HPP admin, utang dagang), Keuangan (laba rugi, produk menguntungkan, stok, rekap PO, piutang), dummy data.

## User Choices
- Stack: React + FastAPI + MongoDB + backup Export/Import JSON/CSV (bukan Node/PostgreSQL)
- Auth: login username + password (JWT); akun demo admin/admin123, kasir/kasir123
- WA: link wa.me dengan teks nota otomatis
- Semua 6 modul dibangun sekaligus (versi inti); tema industrial gelap dengan aksen oranye
- User: JANGAN jalankan test otomatis setelah setiap perubahan

## Architecture
- Backend: core.py (db, auth, penomoran), services.py (kalkulasi, status, auto-PO), routes_master/sales/purchases/reports.py, seed.py
- Frontend: context Auth/Data (bootstrap cache IndexedDB), lib offline.js (queue + auto-sync), public/sw.js (service worker), PrintProvider (preview + window.print), halaman: Dashboard, POS, Sales, Purchases, Stock, Products, Customers, Suppliers, Reports, Settings

## Implemented (2026-09-30)
- Semua 6 modul, RBAC (field HPP/uang dihapus di API untuk kasir), PWA + antrian offline + sinkronisasi otomatis, nota thermal/standard, surat jalan multi-rit, backup
- Tes E2E pertama: backend 29/29 lulus, smoke test frontend lulus
- Perbaikan: tab kategori POS bisa di-scroll horizontal (shrink-0, scrollbar tipis, snap)
- Cetak nota: dialog pilihan printer sebelum mencetak — Thermal 58mm / 80mm (tanpa margin) atau Printer Biasa SmartTank A4 / F4 (faktur lengkap). Setelah dipilih, pratinjau terbuka dan dialog print browser otomatis muncul; tombol "Ganti Printer" ada di pratinjau
- Data uji TEST_ dari testing agent dihapus (stok dikembalikan)
- Indent Builder: cascading dropdown Pabrik → Jenis Material → Merk/Tipe (hanya produk berpanjang milik supplier terpilih); ganti pabrik mereset jenis/merk/tebal/warna; fallback pesan "Tidak ada material kustom untuk pabrik ini" + input merk manual
- POS: urutkan tabel produk dengan klik header (Nama, Stok, Harga; naik/turun)
- Toggle Lengkung dinamis: field produk baru `is_lengkung` (bool, default false) & `upah_lengkung` (number, default 0), produk lama dimigrasi dari bend_fee; toggle hanya muncul untuk kategori Seng/Spandek/Deck/Atap/Alderon; Lurus = upah Rp 0 & field disembunyikan; berlaku di form produk, POS ready, indent builder, keranjang
- POS Ready Stock: daftar produk diubah dari card grid menjadi tabel ringkas (Nama+badge kategori, Stok G1|G2, Harga Satuan, tombol Pilih), container scroll max 58vh dengan sticky header; di mobile stok pindah di bawah nama
- Nota A4/F4: daftar item kini tabel bergaris (No, Nama Barang, Qty, Satuan, Harga Satuan, Disc, Total) + baris rincian upah lengkung; format thermal tidak berubah

## Backlog
- P1: Hapus password_hash dari backup JSON; cetak ulang nota offline setelah sync memakai nomor resmi
- P1: Laporan stok per gudang ke PDF/Excel; riwayat harga beli per supplier
- P2: Scan barcode di POS; ringkasan harian otomatis ke WA pemilik; mode terang
