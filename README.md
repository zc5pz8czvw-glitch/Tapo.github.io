# Zakon Barbershop

Site static, o singură pagină: **`index.html`** (CSS, JavaScript și fotografiile sunt incluse în fișier).
Nu are backend, bază de date, formulare sau chei API. Programările se fac pe Fresha (linkuri externe).

## Publicare (GitHub Pages)

1. Pe GitHub: **Settings → Pages → Build and deployment → Source: Deploy from a branch**,
   Branch: `main`, folder `/ (root)` → **Save**.
2. După 1–2 minute site-ul e disponibil la `https://<utilizator>.github.io/<nume-repo>/`.
3. Opțional (recomandat): domeniu propriu în **Settings → Pages → Custom domain**, apoi bifați **Enforce HTTPS**.

Trimiteți oamenilor **linkul public**, nu fișierul `.html` din Drive/Notițe: aplicațiile de previzualizare
(Notițe, Google Drive, Quick Look, previzualizări din mesagerie) nu rulează JavaScript.
Pagina e construită să arate tot conținutul și acolo, dar programarea online și animațiile au nevoie de un browser.

## Modificări

- Editați `index.html`.
- Dacă modificați un bloc `<script>`, rulați `npm run update-csp` (actualizează politica de securitate CSP);
  altfel browserul va bloca scriptul modificat.
- Teste: `npm install && npm test` (Playwright + Chromium).
