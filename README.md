# JAMAS Matsanewa

Editorial, motion-driven website for **JAMAS Matsanewa**, the student religious and social organization at MTsN 1 Kota Malang.

## Pages

- `index.html` — the main one-page experience: Home, Tentang, Anggota, Program Kami, and Galeri.
- `program-kami.html` — standalone Form Pengaduan page and no-JS fallback for the in-page form dialog.
- `about.html` — small redirect to `index.html#tentang`.
- `vote.html` — **E-Voter**: halaman pemilihan (login NIS/NIM + PIN, 1 pemilih 1 suara; mode data lokal atau terpusat Firebase — lihat bagian E-Voter di bawah). Styling mengikuti identitas situs (forest/ivory/gold).
- `e-voter-admin.html` — Panel Admin E-Voter: kelola pemilihan, kandidat (input manual tanpa batas), import akun pemilih via spreadsheet `.xlsx`/`.csv`, hasil & export CSV. Login awal `admin` / `admin123`.

## Stack

No build step or package manager is required.

- Vanilla HTML, CSS, and JavaScript.
- GSAP + ScrollTrigger and Lenis are vendored in `js/vendor/`.
- Fonts (Anton, Fraunces, Manrope) are self-hosted in `fonts/`.
- Optimized images live in `images/opt/`.

## Local preview

```sh
python3 -m http.server 8898
```

Then open `http://localhost:8898/`.

## E-Voter (vote.html)

Pemilihan online: login **NIS + PIN**, satu pemilih satu suara, hasil terkumpul di panel admin.

### Mode penyimpanan

E-Voter punya dua mode (atur di `js/evoter-config.js`):

| Mode | Cara kerja | Cocok untuk |
|------|-----------|-------------|
| 💾 **Lokal** (default) | localStorage browser | Demo / uji coba di satu perangkat |
| 🌐 **Terpusat (Firebase)** | Firebase Realtime Database | Pemilihan resmi — siswa vote dari perangkat masing-masing, semua suara terkumpul real-time di panel admin |

### Setup mode terpusat (Firebase)

1. Buat proyek gratis di https://console.firebase.google.com → **Build → Realtime Database → Create Database** (lokasi bebas, mulai *test mode*).
2. **Project Settings → Your apps → Web app** → salin `apiKey`, `authDomain`, `databaseURL`, `projectId`.
3. Isi `js/evoter-config.js` dan set `enabled: true`.
4. Push ulang. Setelah aktif, tab badge "🌐 Terpusat" muncul di panel admin dan hasil suara update otomatis saat pemilih lain menekan suara.

> Catatan keamanan: mode terpusat memakai rules terbuka (cocok untuk pemilihan sekolah). Jangan simpan data sensitif di database ini, dan ganti akun admin default `admin / admin123` di tab Pengaturan.

### 🔒 Saklar rules database (wajib dipahami panitia)

Rules Firebase adalah "saklar" aplikasi. Ada dua kondisi, ganti di **Firebase Console → Realtime Database → Rules → Publish**:

**SAAT PEMILIHAN BERJALAN** (buka pemilihan, siswa vote, admin kelola):

```json
{ "rules": { ".read": true, ".write": true } }
```

**DI LUAR PEMILIHAN** (sebelum/acara belum berjalan/sudah selesai — situs E-Voter berhenti berfungsi):

```json
{ "rules": { ".read": false, ".write": false } }
```

Buka saat digelarkan, tutup setelah selesai. Verifikasi cepat: buka
`https://jamasmatsanewa-98921-default-rtdb.asia-southeast1.firebasedatabase.app/evoter/election/meta.json` —
muncul data = terbuka; ditolak/error = terkunci.

## Deployment

The repository is a static site. `CNAME` points to `jamasmatsanewa.me`, and `render.yaml` publishes the repository root (`staticPublishPath: .`).

## Accessibility and fallbacks

- Keyboard navigation, dialog focus handling, and a mobile menu focus trap are included.
- `prefers-reduced-motion` disables Lenis, pinning, and scroll-driven animation; horizontal sections become native scroll areas.
- JavaScript-disabled users get the full content and a working link to the standalone Form Pengaduan page.
