# Audit awal dan perbaikan beranda

Tanggal: 6 September 2026

## Lingkup
Peninjauan struktur React/TypeScript, integrasi API, CSS, penyimpanan preferensi, dan tes backend. Implementasi tahap ini difokuskan pada beranda web; versi GTK dan menu lain belum didesain ulang. Perubahan lokal yang sudah ada dipertahankan.

## Sudah diperbaiki
- Navigasi masuk diberi label Beranda, dengan pencarian utama dan pengantar singkat.
- Koleksi favorit dapat difilter; tombol bintang memiliki nama kitab dan status aksesibel.
- Riwayat kitab dipisahkan dari katalog. Labelnya menyatakan membuka kembali kitab, karena posisi halaman belum disimpan.
- Filter dapat dibuka/tutup pada layar kecil, dilengkapi reset semua.
- Hasil kosong memiliki pesan dan tindakan pemulihan yang berbeda dari kegagalan API.
- Kartu awal dikurangi dari 120 menjadi 24, dengan pemuatan bertahap di sisi UI.
- Respons katalog lama diabaikan ketika permintaan yang lebih baru telah dimulai.
- Kategori tidak lagi disaring dengan teks pencarian judul; placeholder disesuaikan dengan dukungan API (judul atau musonnif).
- Kartu dan area beranda memakai token tema, fokus keyboard, serta tata letak responsif.

## Prioritas berikutnya
1. Pembaca: simpan halaman terakhir per kitab; lindungi pemuatan halaman dan indeks dari respons yang tiba tidak berurutan. Saat ini openBook default ke halaman 1.
2. Pencarian: pisahkan sumber daftar kitab dari hasil filter beranda; saat ini kedua menu memakai state books yang sama.
3. Performa katalog: pisahkan permintaan kategori, musonnif, dan kitab; saat ini Promise.all memuat ulang ketiganya ketika satu filter berubah. Paginasi UI belum mengurangi payload API.
4. Pengaturan/tema: rapikan deklarasi CSS tema yang berulang dan warna hardcoded di menu lain.
5. Ketahanan penyimpanan: validasi bentuk data localStorage dan tangani kegagalan writeStored.
6. Backend: audit penutupan koneksi SQLite; tes menghasilkan ResourceWarning unclosed database.
7. Dokumentasi: README masih mengutamakan versi GTK dan berisi path perangkat yang spesifik.

## Verifikasi
- npm run build: lulus.
- npm test: 2 tes lulus, mencakup shell dan interaksi favorit/pemuatan bertahap/pembukaan kitab.
- PYTHONPATH=native .venv/bin/python -m unittest discover -s tests: 5 tes lulus, dengan ResourceWarning SQLite.
- git diff --check: lulus.
- Pemeriksaan visual browser terhadap data Syamilah asli belum dilakukan; layout mobile dan kedua tema perlu ditinjau langsung sebelum dinyatakan final secara visual.
