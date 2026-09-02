# UI States — Logat Syamilah

Dokumen ini mencatat state utama yang perlu dicek setiap kali frontend dipoles.

## Katalog

- Loading: skeleton pada filter dan grid kitab.
- Empty: lingkaran Arab `لا نتيجة` dan pesan kitab tidak ditemukan.
- Ready: filter fan ilmu, filter musonnif, strip terakhir dibaca, kartu kitab, dan favorit.
- Performance: grid awal hanya merender sebagian kitab, lalu tombol `Tampilkan lagi`.

## Reader

- Empty: belum ada kitab aktif.
- Loading: halaman memakai skeleton di area kertas.
- Ready: judul kitab, bookmark halaman, navigasi halaman, toolbar reader, indeks bab/juz, dan teks Arab RTL.
- Focus mode: header dan indeks disembunyikan untuk ruang baca penuh.
- Annotation: dialog kata, konteks sebelum/sesudah, saran arti otomatis, simpan, hapus, batal, dan toast status.

## Pencarian

- Empty: ilustrasi `بحث` dan pesan untuk memilih kitab.
- Loading: skeleton hasil.
- Ready: panel filter kitab, pilih semua, kosongkan, filter lokal, hasil dengan highlight.
- Shortcut: `Ctrl+K` atau `Cmd+K` membuka halaman pencarian.

## Pengaturan

- Tema: system, light, dark.
- Reader: ukuran huruf, spasi baris, dan lebar kolom.
- Penyimpanan lokal: jumlah favorit, bookmark, terakhir dibaca, pencarian terkini, dan reset preferensi UI.
