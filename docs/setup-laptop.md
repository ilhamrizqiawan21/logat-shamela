# Menjalankan instalasi lokal laptop

Dependensi Python berada di `.venv`. Node.js untuk build berada di `.venv/node`.

## Data Syamilah

Instalasi Maktabah Syamilah tidak disertakan dalam repository. Isi `.env` dengan lokasi instalasi lengkap:

```dotenv
SHAMELA_INSTALL_ROOT=/lokasi/instalasi/shamela
```

Folder tersebut harus berisi `database/master.db`, `app/lucene/2/`, serta Java bawaan pada `app/linux/64/jre/2/bin/java`.

## Menjalankan manual

Auto-start `logat-syamilah.service` sudah dinonaktifkan dan layanan dihentikan sesuai pilihan pengguna. Berkas layanan tetap tersedia di `~/.config/systemd/user/`, tetapi proyek tidak dijalankan saat boot. Pengaturan linger akun tidak menjalankan layanan yang sudah dinonaktifkan ini.

Setelah mengatur lokasi data dan menyelesaikan build, jalankan manual dari folder proyek:

```bash
./run-logat.sh
```

Browser akan dibuka di http://127.0.0.1:8765. Tekan Ctrl+C di terminal untuk menghentikan aplikasi.

Melihat log:

```bash
journalctl --user -u logat-syamilah.service -n 50 --no-pager
```

Menonaktifkan auto-start:

```bash
systemctl --user disable --now logat-syamilah.service
```

Layanan menggunakan lokasi `/home/ilham/Projects/logat-shamela`; perbarui berkas layanan dan jalankan `systemctl --user daemon-reload` bila proyek dipindahkan.

## Memperbarui dependensi dan build

Dari folder utama proyek:

```bash
.venv/bin/pip install -r requirements-web.txt
export PATH="$PWD/.venv/node/bin:$PATH"
npm --prefix web ci
npm --prefix web run build
./run-logat.sh
```

Asisten AI membutuhkan konfigurasi penyedia tersendiri. `.env` awal memakai Ollama; Ollama dan modelnya belum dipasang oleh langkah ini.
