# Ce trebuie să faci tu (în ordine)

Le-am pregătit pe toate cât am putut. Ce rămâne necesită identitatea ta, plăți sau aprobări, pe care nu le pot face eu. Fiecare pas spune unde intri și ce apeși.

Legendă: 💶 = costă bani · ⏱ = cât durează aproximativ

---

## Etapa 0 — Decizii rapide (5 minute)

1. **Numele aplicației în App Store.** „LIFE RPG” poate fi deja luat. Pregătește două variante de rezervă, de exemplu „LIFE RPG: Level Up” sau „Life RPG Quest”.
2. **Identificatorul aplicației (Bundle ID).** Am pus `com.tapo.liferpg`. Nu se mai poate schimba după prima urcare în App Store. Dacă vrei altul, spune-mi înainte; trebuie modificat în `capacitor.config.json` și în proiectul iOS.
3. **E-mailul de contact** pentru utilizatori și pentru Apple, de exemplu o adresă Gmail nouă, dedicată jocului.

## Etapa 1 — Unește codul în repository (5 minute)

Codul e pe ramura `claude/life-rpg`, separat de site-ul tău Zakon Barbershop. Nu atinge fișierele acelui site.

1. Intră pe https://github.com/zc5pz8czvw-glitch/Tapo.github.io.
2. Apasă **Compare & pull request** (sau Pull requests → New → base `main`, compare `claude/life-rpg`) → **Create pull request**.
3. Așteaptă ca verificarea „CI” să devină verde (construiește jocul și compilează aplicația iOS pe un Mac din cloud) → **Merge pull request**.
4. După merge, jocul apare ca aplicație web la: https://zc5pz8czvw-glitch.github.io/Tapo.github.io/life-rpg/web/. Paginile de confidențialitate, termeni și suport sunt în același loc. Apple le cere.

## Etapa 2 — Completează datele legale (10 minute)

Editează pe GitHub fișierul `life-rpg/app/site/site.json` (creionul ✏️ → Commit):
- `operatorName`: numele tău complet, sau firma, dacă ai una;
- `operatorCountry`: țara (România / Republica Moldova);
- `contactEmail`: e-mailul de la Etapa 0.

Apoi cere-mi „regenerează site-ul” sau rulează `npm run site` în `life-rpg/` și fă commit. Fără acești pași, paginile afișează „[de completat]”.

## Etapa 3 — Serverul (Supabase) 💶 0 € la început ⏱ 30–45 minute

Urmează [BACKEND-SI-ADMINISTRARE.md](BACKEND-SI-ADMINISTRARE.md), secțiunea „Configurare de la zero”. Pe scurt:
1. Cont pe supabase.com → **New project**: regiunea **Central EU (Frankfurt)**, cu o parolă de bază de date puternică pe care o păstrezi.
2. Cont pe resend.com, plus un domeniu (💶 ~10–15 €/an), pentru trimiterea codurilor pe e-mail.
3. Cont pe console.anthropic.com → **Billing**: pui un credit (💶 minimum 5 $) → **API Keys** → Create key. Setează o limită lunară de cheltuieli, de exemplu 20 $.
4. Pe GitHub (repository → Settings → Secrets and variables → Actions) adaugi secretele și variabilele din listă.
5. GitHub → Actions → **Backend deploy** → Run workflow.
6. Pui adresa serverului și cheia publică în variabilele GitHub (`SUPABASE_URL`, `SUPABASE_ANON_KEY`).

## Etapa 4 — Apple Developer 💶 99 $/an ⏱ 1–2 zile (aprobarea Apple)

1. https://developer.apple.com/programs/enroll/ → **Start Your Enrollment**, ca persoană fizică (Individual). Îți trebuie un cont Apple cu autentificare în doi pași, numele legal real și adresa.
2. Plătești 99 $/an. Pentru persoane fizice nu există scutire de taxă.
3. Aștepți e-mailul de confirmare.

## Etapa 5 — Aplicația în App Store Connect și cheile pentru urcare ⏱ 30 minute

Urmează [PUBLICARE-APP-STORE.md](PUBLICARE-APP-STORE.md), pașii 2–4:
- creezi aplicația (nume, limbă, Bundle ID `com.tapo.liferpg`);
- creezi o cheie API (App Store Connect → Users and Access → Integrations → Keys) și o pui ca secret pe GitHub;
- pornești GitHub → Actions → **iOS TestFlight** → Run workflow. Aplicația se compilează, se semnează și se urcă singură, fără Mac.

## Etapa 6 — Testare cu prietenii (TestFlight) ⏱ 1–2 săptămâni

- Instalezi aplicația **TestFlight** pe iPhone și testezi tu.
- Inviți 10–30 de prieteni (testare externă; prima versiune trece printr-o verificare scurtă la Apple).
- Notezi ce nu merge și îmi spui; corectez și urci din nou (Run workflow).

## Etapa 7 — Trimiterea spre verificare ⏱ 1–3 zile răspunsul Apple

În App Store Connect completezi:
- textele, care sunt gata în PUBLICARE-APP-STORE.md;
- capturile, care sunt gata în `store/screenshots/`;
- chestionarele de vârstă și confidențialitate, cu răspunsurile pregătite;
- un **cont demo** pentru verificatori.

Apoi apeși **Add for Review** → **Submit**.

## Etapa 8 — Doar dacă vrei să vinzi ceva mai târziu (abonament Premium)

Nu e necesar la lansare. Când vrei:
1. App Store Connect → Business → semnezi **Paid Apps Agreement**, completezi formularul fiscal (W-8BEN) și contul bancar.
2. Te înscrii în **App Store Small Business Program** (comision 15% în loc de 30%).
3. **Statutul de comerciant (DSA, UE)**: dacă vinzi, adresa și telefonul tău devin publice pe pagina din UE. Poate merită un PFA/ÎI și o adresă de firmă. Consultă un contabil.
4. Îmi ceri să implementez cumpărarea în aplicație; serverul are deja planul „premium” pregătit.

---

### Ce NU trebuie să faci
- Nu pune nicio cheie secretă (Anthropic, Supabase „service_role”, parola bazei de date) în cod sau în `app/config.json`. Doar în **GitHub Secrets** sau în **Supabase Secrets**. Build-ul refuză automat cheia `service_role`.
- Nu face repository-ul privat fără să citești nota din COSTURI-SI-VENITURI.md: compilarea iOS gratuită pe Mac-urile GitHub e doar pentru repository-uri publice.
