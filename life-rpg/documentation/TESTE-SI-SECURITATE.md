# Teste, securitate și probleme cunoscute

Am separat clar ce a fost **rulat efectiv** și a trecut, de ce **nu a putut fi testat** aici.

## 1. Teste rulate (toate trec)

Mediul de test e stiva Supabase completă, rulată local în Docker, cu aceleași imagini ca serverul real:
- Postgres 17 (imaginea Supabase);
- Auth (GoTrue v2.197);
- PostgREST v14;
- Edge Runtime v1.77;
- server de e-mail de test;
- furnizor AI simulat.

Aplicația a fost rulată în Chromium (Playwright).

### Backend: 24 de teste (`npm run test:backend`)
| # | Test | Rezultat |
|---|---|---|
| 1 | Înregistrare cu cod pe e-mail, profil și cod de prieten create automat | ✅ |
| 2 | Fără confirmarea e-mailului nu există sesiune | ✅ |
| 3 | Cod greșit refuzat; parolă slabă refuzată | ✅ |
| 4 | Resetarea parolei prin cod; parola veche nu mai merge | ✅ |
| 5 | Filtrul de nume: refuză insulte RO/EN/RU, linkuri; acceptă diacritice, chirilic, „Făgăraș” | ✅ |
| 6 | Salvare: prima scriere, conflict între dispozitive, adoptare, forțare, limită de frecvență, mărime maximă | ✅ |
| 7 | **Izolare:** B nu vede și nu poate modifica salvarea lui A; nu se poate autopromova „premium”; nu poate apela funcțiile de cote AI; nu citește raportările | ✅ |
| 8 | Fără cont, cu cheia publică, nu se poate face nimic | ✅ |
| 9 | Prieteni prin cod, clasament, blocare și deblocare, eliminare | ✅ |
| 10 | Creșteri de XP neplauzibile plafonate (anti-trișare) | ✅ |
| 11 | Liga: apare doar cine o alege; blocații nu apar | ✅ |
| 12 | Raportări acceptate și limitate | ✅ |
| 13 | Erori din aplicație înregistrate (doar cu cont) | ✅ |
| 14 | **Ștergerea contului șterge tot:** profil, salvare, carte, prietenii, erori | ✅ |
| 15–24 | Mentorul AI: fără sesiune → 401; fără acord → 403; chat în 3 limbi; JSON pentru misiuni; cereri invalide sau prea mari; erori ale furnizorului (500, 429, 529, răspuns gol) cu cota returnată; limită pe minut; o singură cerere în curs; timeout de 35 s → 504 în ~25 s; cota zilnică; cont suspendat | ✅ |

Testele Mentorului au trecut cu **toți cei trei furnizori**: Anthropic (SDK oficial), API compatibil OpenAI și Gemini, pe furnizorul simulat. Cererea trimisă către Anthropic a fost verificată:
- modelul `claude-haiku-5-5`;
- gândirea extinsă oprită, efort redus;
- promptul de sistem pus în cache.

### În browser: 9 teste (`npm run test:e2e`)
| Test | Rezultat |
|---|---|
| Flux complet prin interfață: cont nou cu cod din e-mail → salvare automată în cont → acord AI → răspuns AI → sugestii AI → raportare → al doilea jucător adaugă codul de prieten → blocare → al doilea dispozitiv (interfață în rusă) se autentifică și restaurează progresul → parolă greșită → ștergerea contului din interfață | ✅ fără nicio eroare în pagină |
| Fără text românesc rămas în engleză și rusă (toate ecranele și foile noi) | ✅ |
| Fără internet: joc funcțional, salvarea așteaptă, Mentorul local; la revenire se sincronizează | ✅ |
| Server căzut: mesaj clar, date păstrate local, reîncercare automată reușită după revenire | ✅ |
| Aplicație închisă în timpul salvării: nimic pierdut, fără conflict fals | ✅ |
| PWA: după prima vizită pornește fără internet, cu progresul păstrat | ✅ |
| Seria: punți, scut folosit automat, scut păstrat dacă nu ajunge, revenire reușită și pierdută, scut câștigat în ziua a 7-a, plafon 2, repararea datelor greșite, interfața zilelor libere | ✅ |
| Securitate XSS: nume de prieten cu cod HTML și răspuns AI cu `<script>`, `onerror`, `javascript:` nu se execută | ✅ |

### Build și iOS
| Verificare | Rezultat |
|---|---|
| Build strict (eșuează dacă lipsește vreo traducere EN/RU, dacă marcajele sau parametrii traducerilor nu se potrivesc ori dacă JavaScript-ul e invalid) | ✅ 2.237 de texte traduse |
| Build-ul refuză chei secrete în configurație (de ex. `service_role`) | ✅ |
| Compilare iOS pe GitHub Actions (macOS, Xcode 26.6, SDK iOS 26.5) | ✅ „BUILD SUCCEEDED” |
| `npm audit`, dependențele aplicației | ✅ 0 vulnerabilități |

### Test de încărcare (`node tests/load/load.mjs`)
Pe stiva locală (4 nuclee), fiecare jucător face ciclul aplicației: verificare copie, salvare de ~10 KB comprimată, clasament, carte de joc.

| Jucători simultani | Operații în 60 s | Erori | Latență p50 / p95 / max | 300 de cereri AI simultane |
|---|---|---|---|---|
| 100 | 6.120 | 0 | 5 / 9 / 106 ms | 100/100 OK, p95 3,3 s |
| 300 | 18.136 | 0 | 4 / 9 / 107 ms | 300/300 OK, p95 8,9 s |

**Interpretare cinstită.** Rezultatele sunt orientative. Serverul Supabase Free/Pro are mai puține resurse decât testul local (planul Pro include o instanță „Micro”), dar un jucător real face o salvare la ~15 secunde după modificări, nu la câteva secunde. Estimez că planul Pro susține confortabil mii de utilizatori activi pe zi. Când contează, verifici în Supabase → Reports. Latența AI reală se adaugă (de obicei 2–8 s pentru Haiku), iar funcțiile Supabase se scalează automat.

## 2. Audit de securitate (rezumat)

| Zona | Constatare / măsură |
|---|---|
| Secrete | Nicio cheie secretă în aplicație. Cheia AI și cheia `service_role` stau doar pe server sau în GitHub Secrets. Build-ul blochează automat cheile secrete. `supabase/local/dev.env` conține doar chei locale de test, fără valoare reală |
| Acces la date | RLS activ pe toate tabelele. Clientul are doar drept de citire pe propriile rânduri. Toate scrierile trec prin funcții care verifică `auth.uid()` și validează datele. Funcțiile au `search_path` gol (protecție la deturnare). Drepturile de execuție sunt acordate explicit, iar funcțiile noi nu devin publice implicit |
| Autentificare | Conturi Supabase Auth: parole hash, coduri OTP de 6 cifre cu expirare în 1 oră, minimum 8 caractere cu litere și cifre, limite de rată pe e-mail și autentificare. Sesiunile se reîmprospătează cu rotație de token |
| Manipularea XP / clasamentului | Datele vin de la jucător (activități declarate), deci nu pot fi dovedite. Serverul plafonează creșterile (max ~8.000 XP/zi față de ultima publicare, XP săptămânal ≤ 56.000) și limitează frecvența. Clasamentul e prezentat sincer ca fiind bazat pe activitatea declarată |
| Abuzul AI | Necesită cont confirmat și acord. Limite: 15 pe zi, 6 pe minut, o cerere în curs, plafon global zilnic. Promptul e construit pe server (funcția nu poate fi folosită ca chatbot general). Mărimea cererii e limitată (64 KB, context 16 KB, 1.500 de caractere pe mesaj). Răspunsul e plafonat (900–1.800 de tokeni) |
| Prompt injection | Regulile spun modelului să trateze datele ca date. Chiar dacă cineva păcălește modelul, afectează doar propriul răspuns. Modelul nu are unelte, nu scrie în baza de date și nu acordă XP |
| XSS | Toate valorile sunt escapate la randare (testat). Politică CSP strictă: scripturi doar din pagină, conexiuni doar către serverul jocului, fără iframe-uri și formulare externe |
| Conținut generat | Filtru de nume pe server (insulte RO/EN/RU, linkuri), raportare și blocare, moderare manuală (vezi BACKEND), suspendarea conturilor |
| Confidențialitate | Date minime (e-mail și date de joc). Fără tracking, reclame sau analiză de la terți. Fontul e găzduit local, fără Google Fonts. Ștergere completă din aplicație. Erorile sunt păstrate 30 de zile |
| Minori | Cont doar de la 16 ani (vârsta de consimțământ digital din România). Fără cont, nimic nu e trimis |
| Dependențe | Versiuni fixate, cu cel puțin 2 săptămâni vechime. `npm audit`: 0 vulnerabilități în aplicație; 3 „moderate” doar în unealta de build Capacitor CLI (`uuid` prin `xcode`), care nu ajunge în aplicație și nu e exploatabilă în folosirea noastră |

## 3. Ce nu am putut testa aici (și cum testezi tu)

| Ce | De ce | Cum se verifică |
|---|---|---|
| Serverul Supabase real (cloud) | nu am cont Supabase (ar cere contul tău) | după „Backend deploy”, instalezi aplicația din TestFlight, creezi cont, verifici e-mailul și salvarea |
| Livrarea reală a e-mailurilor (Resend) | nu am domeniu sau cont | creezi un cont de test; verifici și Spam |
| Calitatea răspunsurilor AI reale în RO/RU | nu folosesc cheia ta Anthropic fără aprobare (costă bani) | după configurare, pui Mentorului 10–20 de întrebări în fiecare limbă. Alternativ, îmi dai o cheie de test cu limită de 1–2 $ și rulez eu un test |
| Aplicația iOS pe un iPhone sau în simulator (interfața) | aici nu există macOS; am verificat doar compilarea | TestFlight. Puncte de verificat: zona de sus (notch), tastatura în chat, memento-urile, partajarea copiei de siguranță |
| Notificările locale pe iPhone | necesită dispozitiv | Profil → Setări notificări → Memento zilnic → ora peste 2 minute → închizi aplicația |
| Urcarea în TestFlight | necesită cont Apple | rulezi fluxul „iOS TestFlight” după pașii din PUBLICARE-APP-STORE.md |

## 4. Probleme și limitări cunoscute
- **Clasamentul se bazează pe activitatea declarată.** E limitat de server, dar nu poate verifica viața reală (ca la Habitica, Duolingo etc.). E spus deschis în aplicație.
- **Moderarea e manuală** (interogări SQL). La sute de raportări pe săptămână ar merita un mic panou de administrare.
- **Proiectul Supabase Free intră în pauză** după inactivitate. Pentru lansare e recomandat Pro (25 $/lună).
- **Conversația cu Mentorul face parte din copia salvată în cont.** E menționat în politica de confidențialitate. Se șterge cu „Șterge conversația” sau cu ștergerea copiei sau a contului.
- **Codul de jucător offline (LRPG1…)** e un instantaneu: se actualizează doar când e retrimis. Cu cont, prietenii se actualizează automat.
- **Testele backend și e2e rulează local, nu în CI**, pentru că cer stiva Docker. CI verifică build-ul, traducerile și compilarea iOS. Le poți rula oricând cu `npm test`.
- **Bundle ID-ul `com.tapo.liferpg`** e ales de mine. Se poate schimba doar înainte de prima urcare.
- **Fără Sign in with Apple sau Google.** Nu e obligatoriu (avem doar conturi proprii); se poate adăuga ulterior.
