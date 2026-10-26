# JAMAS Matsanewa

Editorial, motion-driven website for **JAMAS Matsanewa**, the student religious and social organization at MTsN 1 Kota Malang.

## Pages

- `index.html` — the main one-page experience: Home, Tentang, Anggota, Program Kami, and Galeri.
- `program-kami.html` — standalone Form Pengaduan page and no-JS fallback for the in-page form dialog.
- `about.html` — small redirect to `index.html#tentang`.
- `vote.html` — **E-Voter**: halaman pemilihan (login NIS/NIM + PIN, 1 pemilih 1 suara, data tersimpan di localStorage browser). Styling mengikuti identitas situs (forest/ivory/gold).
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

## Deployment

The repository is a static site. `CNAME` points to `jamasmatsanewa.me`, and `render.yaml` publishes the repository root (`staticPublishPath: .`).

## Accessibility and fallbacks

- Keyboard navigation, dialog focus handling, and a mobile menu focus trap are included.
- `prefers-reduced-motion` disables Lenis, pinning, and scroll-driven animation; horizontal sections become native scroll areas.
- JavaScript-disabled users get the full content and a working link to the standalone Form Pengaduan page.
