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
