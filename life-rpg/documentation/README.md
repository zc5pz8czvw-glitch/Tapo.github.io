# LIFE RPG — documentația proiectului

LIFE RPG este un joc de progres personal: activitățile reale devin misiuni, XP, niveluri, abilități, Boss Battle-uri și serii de zile. Are un Mentor (local, plus AI opțional), prieteni, Liga săptămânii și trei limbi (RO/EN/RU).

Proiectul funcționează **independent de Claude și de contul tău Claude**:
- jocul rulează singur pe telefon (aplicație iOS) sau în browser (aplicație web instalabilă);
- datele jucătorilor stau pe serverul tău (Supabase);
- Mentorul AI trece printr-o funcție server proprie, care păstrează cheia AI ca secret.

## Ce găsești aici

| Fișier | Pentru ce |
|---|---|
| [ACTIUNILE-TALE.md](ACTIUNILE-TALE.md) | **Începe de aici.** Lista exactă, în ordine, cu ce trebuie să faci tu (conturi, plăți, aprobări) |
| [PUBLICARE-APP-STORE.md](PUBLICARE-APP-STORE.md) | Pașii de publicare în App Store, cerințele Apple, textele pentru pagina din magazin, răspunsurile la chestionare |
| [BACKEND-SI-ADMINISTRARE.md](BACKEND-SI-ADMINISTRARE.md) | Configurarea serverului (Supabase, e-mail, AI), administrare, monitorizare, recuperare, actualizări |
| [COSTURI-SI-VENITURI.md](COSTURI-SI-VENITURI.md) | Costuri inițiale și lunare, strategia de lansare și de monetizare, riscuri |
| [TESTE-SI-SECURITATE.md](TESTE-SI-SECURITATE.md) | Testele efectuate și rezultatele lor, auditul de securitate, problemele cunoscute, ce nu a putut fi testat |
| [CERCETARE.md](CERCETARE.md) | Analiza aplicațiilor populare și a cerințelor Apple (cu surse) și deciziile luate pe baza lor |
| [DEZVOLTARE.md](DEZVOLTARE.md) | Instalare, rulare locală, structura codului, cum modifici texte și traduceri, comenzi |

## Arhitectura, pe scurt

```
 Telefon (aplicația iOS)  ─┐
 Browser (aplicația web)  ─┤   HTTPS   ┌──────────── Supabase (serverul tău) ─────────────┐
                           ├──────────►│ Auth: conturi, coduri pe e-mail                   │
 Jocul merge complet și    │           │ Postgres: salvări, prieteni, ligă, raportări      │
 fără internet / fără cont │           │   (reguli RLS: fiecare își vede doar datele lui)  │
                           │           │ Funcția „mentor”: limite, instrucțiuni, cheia AI ─┼──► Anthropic (Claude Haiku)
                           └──────────►└───────────────────────────────────────────────────┘     sau alt furnizor
```

- **Fără cont**: tot jocul merge local, inclusiv Mentorul local (reguli pe datele reale), clasamentul prin coduri, seria, Focus și revizuirile.
- **Cu cont (gratuit)**: se adaugă salvarea în cont și restaurarea pe alt telefon, prietenii actualizați automat, Liga săptămânii și Mentorul AI, care cere un acord separat.

## Ce s-a schimbat față de versiunea din artefactul Claude

| Zona | Înainte (artefact) | Acum |
|---|---|---|
| Rulare | doar în claude.ai | aplicație iOS, aplicație web instalabilă (PWA), funcționează offline |
| Conturi | contul claude.ai al vizitatorului | conturi proprii: e-mail și parolă, cod de confirmare, resetare, ștergere din aplicație |
| Salvare în cont | stocarea artefactului | baza de date proprie, scriere atomică, detectarea conflictelor între dispozitive |
| Mentor AI | Claude din contul vizitatorului | funcție server proprie, cu acord explicit, limită zilnică, protecție la abuz și furnizor interschimbabil |
| Clasament | coduri + tabel public în artefact | coduri (offline) + prieteni prin cont + Liga săptămânii (opțională), cu raportare și blocare |
| Seria | se rupea la prima zi pierdută | scuturi câștigate prin joc, zile libere alese, misiunea de revenire, praguri |
| Memento-uri | doar în aplicație | memento zilnic opțional pe telefon (cel mult unul pe zi) |
| Securitate | — | reguli RLS, CSP, filtru de nume, limite de rată, teste de izolare și XSS |

## Structura folderului `life-rpg/`

```
app/src/index.html     codul jocului (sursa, text în română)
app/i18n/              traducerile EN/RU (b*.json, k*.json, pl.json pentru plurale)
app/public/            manifest PWA, service worker, iconițe, fonturi
app/site/              politica de confidențialitate, termenii, pagina de suport (RO/EN/RU)
app/config.json        configurația publică (adresa serverului, linkuri) — fără secrete
supabase/              backend: migrații SQL, funcția „mentor”, șabloane e-mail, stiva locală de test
ios/                   proiectul Xcode (Capacitor)
tests/                 teste backend, în browser (e2e), de încărcare
tools/                 build, traduceri, capturi de ecran, site
store/screenshots/     capturile pentru App Store (RO/EN/RU, 6.9" și 6.3")
web/                   site-ul construit, publicat de GitHub Pages după merge în main
```
