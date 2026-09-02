# Frontend TODO — Logat Syamilah

Dokumen ini menjadi arah pemolesan antarmuka Logat Syamilah. Prioritasnya adalah aplikasi pembaca kitab yang terasa modern, tenang, dan layak dipakai lama. Ukuran bundle atau jumlah komponen bukan batas utama selama pengalaman pengguna membaik.

## Prinsip desain

- Reader adalah pusat pengalaman: teks Arab harus luas, mudah dibaca, dan bebas gangguan.
- Indonesia dipakai untuk kontrol aplikasi; Arab mempertahankan arah RTL dan tipografi khusus.
- Tampilan desktop seperti meja belajar: indeks menetap, halaman kitab sebagai fokus, dan aksi tidak tersembunyi.
- Ponsel/tablet tetap nyaman: sidebar berubah menjadi panel/laci, bukan sekadar kolom yang dipersempit.
- Warna bernuansa kertas, hijau Syamilah, dan aksen tembaga untuk logat; dukung dark mode setelah fondasi stabil.

## Prioritas tinggi — fondasi visual

- [x] Pecah frontend menjadi komponen React: `AppShell`, `BookCatalog`, `Reader`, `ReaderIndex`, `SearchWorkspace`, dan `AnnotationEditor`.
- [x] Gunakan sistem komponen/UI modern internal untuk tombol, input, dialog, sheet/sidebar, skeleton, dan empty/error state yang konsisten.
- [x] Gunakan token CSS terstruktur untuk warna, radius, spacing, shadow, dan breakpoints.
- [x] Tambahkan tipografi Arab (`Amiri`) dengan fallback yang baik.
- [x] Bentuk ulang header: identitas aplikasi dan navigasi yang jelas.
- [x] Buat sidebar indeks desktop yang sticky dan panel `Sheet` ponsel untuk bab/juz.
- [x] Tambahkan skeleton loading untuk katalog, indeks, halaman kitab, dan hasil pencarian.
- [x] Tampilkan error state yang jelas dengan tombol coba lagi, bukan hanya teks error.

## Prioritas tinggi — reader

- [x] Sediakan pengaturan ukuran huruf, tinggi baris, lebar kolom, dan font Arab langsung dari reader.
- [x] Tambahkan mode fokus: menyembunyikan header/indeks sementara untuk membaca penuh.
- [x] Jadikan daftar Juz/Jilid sebagai segmented control atau daftar ringkas yang menunjukkan bagian aktif.
- [x] Buat struktur indeks bab bertingkat berdasarkan `parent`, dengan expand/collapse dan penanda bab aktif.
- [x] Sorot bab aktif pada sidebar berdasarkan halaman yang sedang dibaca.
- [x] Berikan animasi transisi halus antarhalaman dan kembalikan posisi gulir ke atas dengan indikator loading.
- [x] Tingkatkan token logat: hover/focus state, arti di bawah kata tanpa mengganggu ritme teks, dan popover untuk kata panjang.
- [x] Dialog anotasi yang lengkap: kata asli, konteks sebelum/sesudah, arti yang ada, tombol hapus, keyboard shortcut, dan status tersimpan.

## Prioritas menengah — katalog dan pencarian

- [x] Katalog dengan kartu kitab yang lebih informatif: penulis, kategori, jumlah jilid, dan status terakhir dibaca.
- [x] Simpan dan tampilkan “terakhir dibaca” serta “kitab favorit”.
- [x] Filter kategori/musonnif memakai panel yang dapat dicari.
- [x] Halaman pencarian terpisah dengan checklist kitab sebagai panel filter yang dapat dipilih semua/dikosongkan.
- [x] Hasil pencarian menampilkan cuplikan yang aman, nama kitab, penulis, nomor halaman, dan sorotan kata cocok.
- [x] Tambahkan pencarian terkini, preset filter, serta shortcut `Ctrl+K` untuk pencarian global.

## Prioritas menengah — kenyamanan dan aksesibilitas

- [x] Dark mode dan pilihan tema sistem.
- [x] Kontras warna, focus ring, label form, shortcut keyboard, serta navigasi keyboard dasar.
- [x] Empty state yang ilustratif untuk belum memilih kitab, indeks kosong, dan hasil pencarian kosong.
- [x] Toast untuk simpan/hapus logat serta status koneksi pembaca Syamilah.
- [x] Responsif untuk 360 px, tablet portrait, laptop, dan layar lebar.

## Prioritas menengah — performa dan stabilitas

- [x] Debounce input katalog dan musonnif agar API tidak dipanggil pada setiap ketukan.
- [x] Batasi render katalog awal dan sediakan tombol `Tampilkan lagi` untuk daftar kitab besar.
- [x] Batasi checklist pencarian dengan filter lokal agar daftar ribuan kitab tetap ringan.
- [x] Simpan preferensi ringan di `localStorage` dengan fallback aman untuk render/test.
- [x] Tambahkan health check lokal untuk menampilkan status koneksi pembaca Syamilah.

## Sentuhan akhir

- [x] Ikon aplikasi dan favicon modern yang konsisten dengan identitas “ل”.
- [x] Micro-interaction ringan untuk tombol, bookmark, membuka indeks, dan menyimpan anotasi.
- [x] Halaman pengaturan: preferensi tampilan reader, reset layout, dan informasi penyimpanan lokal.
- [x] Dokumentasi screenshot/UI states di folder `docs/` setelah desain pertama selesai.

## Urutan implementasi yang disarankan

1. Refactor komponen + design tokens + header/sidebar responsif.
2. Reader: tipografi, kontrol tampilan, indeks bertingkat, editor anotasi.
3. Katalog dan pencarian modern.
4. State loading/error/empty, aksesibilitas, dark mode, dan polish animasi.
