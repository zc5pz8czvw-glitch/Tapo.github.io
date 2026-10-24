# Dezvoltare: instalare, rulare, structură, comenzi

## Ce îți trebuie
- Node.js 22, de la https://nodejs.org
- Docker, doar pentru serverul local de test
- un Mac doar dacă vrei să rulezi aplicația iOS local; altfel, compilarea se face pe GitHub

## Instalare și rulare
```
cd life-rpg
npm ci                         # dependențele
npm run build                  # construiește jocul → build/www (configurația din app/config.json)
npm run serve                  # http://localhost:8080
```

### Cu serverul local (conturi, salvare, AI simulat)
```
npm run stack:up               # pornește stiva Supabase locală (Docker) și aplică migrațiile
npm run build:local            # jocul legat de serverul local (app/config.local.json)
npm run serve
npm test                       # testele backend și cele în browser
npm run test:load              # testul de încărcare (100 de jucători, 60 s)
npm run stack:down             # oprește și șterge stiva locală
```

## Comenzi utile
| Comandă | Ce face |
|---|---|
| `npm run build` | build strict: eșuează dacă lipsesc traduceri EN/RU |
| `npm run site` | construiește site-ul (joc + pagini legale) în `web/`, publicat după merge în main |
| `npm run screenshots` | regenerează capturile pentru App Store; mai întâi `npm run build` și `npm run serve` |
| `npm run icons` | regenerează iconițele din `app/art/icon.svg` |
| `npx cap sync ios` | copiază jocul construit în proiectul iOS |
| `npx cap open ios` | (pe Mac) deschide proiectul în Xcode |

## Cum modifici textele și traducerile
1. Scrii textul **în română** direct în `app/src/index.html`.
2. Rulezi `npm run build`. Dacă textul e nou, build-ul se oprește și afișează lista textelor fără traducere.
3. Adaugi traducerile într-un fișier nou `app/i18n/k005.json`: `[["text ro", "english", "русский"], …]`. Păstrezi exact `{0}`, `{1}` și marcajele HTML.
4. Pluralele se pun în `app/i18n/pl.json`: `"zi|zile": ["day|days", "день|дня|дней"]`.

## Structura codului jocului (`app/src/index.html`)
Fișierul e împărțit în module marcate cu `/* ---- NN-nume.js ---- */`:

| Modul | Rol |
|---|---|
| 00-i18n | limba și traducerea la rulare |
| 01-util | utilitare, șabloane HTML sigure (escapare automată) |
| 02-config | formule XP, ranguri, limite, setările seriei (`guard`), ale AI-ului și ale salvării |
| 03-content | misiuni-șablon, Boss Battle, realizări, abilități |
| 04-val | validare, migrare și repararea datelor salvate |
| 05-store | salvarea locală (IndexedDB + localStorage) |
| 06-stats | statistici calculate din date reale, inclusiv seria cu punți |
| 07-engine | motorul jocului (XP, misiuni, scuturi, revenire, rollover zilnic) |
| 08-host | **Backend** (conturi, apeluri RPC, Mentor), Platform (web/iOS), Host, **Cloud** (salvarea în cont) |
| 08b-social | coduri de jucător, prieteni prin cont, Liga, raportare și blocare |
| 09-ai | Mentorul: context, mentor local, furnizorul „cloud” |
| 10–17 | interfața (ecrane, foi: cont, serie, memento etc.) |
| 18-app | pornire, rollover, sincronizare, erori |

## Backend (`supabase/`)
- `migrations/`: schema SQL (tabele, reguli RLS, funcții). Pentru o modificare adaugi un fișier nou; nu editezi migrațiile vechi.
- `functions/mentor/`: funcția AI. `_shared/prompt.ts` conține instrucțiunile, `_shared/providers.ts` furnizorii.
- `templates/`: e-mailurile cu cod (RO/EN/RU).
- `local/`: stiva de test (docker compose), poarta locală, AI-ul simulat.
- `config.toml`: setările proiectului pentru Supabase CLI.

## Proiectul iOS (`ios/`)
- Generat cu Capacitor 8 (Swift Package Manager), apoi personalizat:
  - doar iPhone, doar portret;
  - iconița și ecranul de pornire;
  - `PrivacyInfo.xcprivacy`;
  - declarația de criptare și limbile RO/EN/RU.
- `ios/App/App/public/` se generează la `npx cap sync ios`, deci nu se pune în Git.
- Versiunea se schimbă în Xcode sau în `project.pbxproj`, la `MARKETING_VERSION`. Numărul build-ului crește automat în fluxul TestFlight.
