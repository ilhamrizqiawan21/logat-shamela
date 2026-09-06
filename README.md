# Logat Syamilah

Aplikasi desktop GTK4 untuk memberi arti/logat manual pada setiap kata kitab Maktabah Syamilah 4. Versi web lama tetap tersedia sebagai cadangan.

## Menjalankan versi web modern dari sumber

Versi web memakai FastAPI, React, dan TypeScript; tetapi untuk pemakaian sehari-hari hanya satu proses Python yang berjalan dan browser dibuka otomatis.

```bash
python3 -m venv .venv
.venv/bin/pip install -r requirements-web.txt
cd web && npm install && npm run build && cd ..
./run-logat.sh
```

Server hanya mendengarkan `127.0.0.1:8765`; data Maktabah Syamilah tetap dibaca saja. Anotasi lama dari `logat/logat.db` dimigrasikan otomatis ke `~/.local/share/logat-syamilah/logat.db`.

### Backup dan restore logat

Logat dan bookmark disimpan lokal per-device di `~/.local/share/logat-syamilah/logat.db`. Dari menu **Pengaturan**, gunakan **Unduh backup logat** untuk membuat file JSON, lalu **Pulihkan backup** hanya pada device yang dipilih. Tidak ada sinkronisasi otomatis antar-device; restore mengganti logat dan bookmark lokal setelah konfirmasi.

Asisten AI dapat memakai Ollama secara lokal tanpa billing API. Default lokal adalah `qwen2.5:7b`. Pastikan nama pada `OLLAMA_MODEL` sama persis dengan model yang tersedia di `ollama list`. Jika ingin mengganti model, atur `OLLAMA_MODEL` dan pastikan model tersebut sudah tersedia. OpenAI API tetap dapat dipakai dengan `AI_PROVIDER=openai` dan `OPENAI_API_KEY`.

Untuk Gemini, gunakan `.env` di folder utama proyek. Isi `GEMINI_API_KEY` dan pastikan `AI_PROVIDER=gemini`, lalu mulai ulang `./run-logat.sh`. Model default adalah `gemini-3.5-flash-lite`. `GEMINI_TIMEOUT` mengatur batas waktu permintaan (default 45 detik), dan `GEMINI_MAX_OUTPUT_TOKENS` membatasi panjang keluaran (default 500). Key kosong menghasilkan pesan konfigurasi tanpa mengirim permintaan ke Gemini. `.env` diabaikan Git; jangan memasukkan key ke variabel `VITE_` karena variabel tersebut masuk frontend.

Pembaca mengingat halaman terakhir dan posisi gulir per halaman di browser yang sama. Nomor halaman diterapkan dengan Enter atau tombol **Buka**. Cakupan **Cari dalam kitab** terpisah dari filter beranda.

### Tampilan bacaan

Buka **Tampilan bacaan** pada pembaca untuk mengatur ukuran teks, jarak baris, lebar bacaan, font, dan ukuran logat. **Tampilkan logat** menyembunyikan atau menampilkan arti tanpa menghapus anotasi. Pengaturan yang sama tersedia di **Pengaturan → Pembaca** dan disimpan pada browser ini.

Beranda mendahulukan **Lanjutkan membaca** ketika riwayat kitab tersedia. Tombol AI menunjukkan status nonaktif jika asisten belum diaktifkan; aktifkan melalui **Pengaturan**. Panel analisis menampilkan penyedia/model yang digunakan.

### Draf logat dan bookmark

Draf arti disimpan otomatis di browser per kata dan dipulihkan ketika kata yang sama dibuka lagi, termasuk setelah memuat ulang aplikasi. Draf belum masuk database atau backup logat sebelum menekan **Simpan**. Jika penyimpanan browser gagal, editor menampilkan peringatan dan meminta konfirmasi sebelum ditutup.

Gunakan **Simpan & kata berikutnya** atau `Ctrl+Shift+Enter` untuk menyimpan lalu mengedit kata berikutnya pada halaman yang sama. `Ctrl+Enter` menyimpan dan menutup editor. Ketika penyimpanan gagal, draf dan kata aktif tetap dipertahankan.

Menu **Bookmark** menampilkan seluruh bookmark dengan pencarian judul/musonnif/nomor halaman, filter kitab, pemuatan bertahap, dan penghapusan per halaman. Menu ini juga tersedia melalui **Kelola semua bookmark** pada indeks pembaca.

## Menjalankan versi native GTK dari sumber

Jalankan:

```bash
./run-native.sh
```

Versi native tidak membuka browser dan tidak menjalankan server HTTP. Pilih kitab, buka halaman, klik kata Arab, lalu masukkan artinya.

## Memasang paket Debian

```bash
sudo apt install ./dist/logat-syamilah_0.2.2_amd64.deb
```

Sesudah terpasang, buka **Logat Syamilah** dari menu aplikasi atau jalankan `logat-syamilah`.

Catatan native disimpan di `~/.local/share/logat-syamilah/logat.db`. Pada penggunaan pertama, catatan lama dari `logat/logat.db` disalin dan dimigrasikan otomatis. Folder `database/` dan `app/` milik Syamilah hanya dibaca dan tidak diubah. Tombol backup menyimpan salinan di `~/.local/share/logat-syamilah/backups/`.

Pintasan: `Ctrl+F` mencari kitab, `Ctrl+S` menyimpan logat, panah kiri/kanan berpindah halaman, dan `Esc` menutup editor.

Kode pembaca Lucene menggunakan helper MIT dari proyek `alhoqbani/shamela-mcp`; lihat `vendor/LICENSE` dan sumber: https://github.com/alhoqbani/shamela-mcp
