# Backend: configurare, administrare, monitorizare, recuperare

## Ce rulează pe server și de ce

| Serviciu | Rol | Cine îl ține pornit |
|---|---|---|
| **Supabase** (Auth, Postgres, Edge Functions) | conturi, coduri pe e-mail, salvări, prieteni, ligă, raportări, funcția „mentor” | Supabase, serviciu administrat: nu pornești nimic manual |
| **Resend** (sau alt SMTP) | trimite codurile de confirmare și resetare | Resend |
| **Anthropic API** | modelul AI pentru Mentor (Claude Haiku 5.5) | Anthropic, cu plată la consum |
| **GitHub** (Actions + Pages) | compilează și urcă aplicația iOS, publică site-ul și paginile legale | GitHub, gratuit pentru repository public |

Nimic din toate acestea nu depinde de Claude.ai sau de conversațiile tale cu mine. Cheia Anthropic e o cheie de dezvoltator separată, cu facturarea ei proprie. Furnizorul AI se poate schimba dintr-o variabilă (`AI_PROVIDER`): `anthropic`, `openai` (OpenAI, Mistral, Groq, DeepSeek prin API compatibil) sau `gemini`.

### De ce Supabase (și nu alternativele)

| Criteriu | Supabase | Cloudflare Workers + D1 | Firebase |
|---|---|---|---|
| Conturi și e-mail incluse | ✅ (testate, sigure) | ❌ trebuie scrise de la zero (risc de securitate) | ✅ |
| Reguli de acces în baza de date (RLS) | ✅ SQL standard | parțial | reguli proprii |
| Cost la început | 0 $ (Free) / 25 $ (Pro) | 0–5 $ | 0 $, dar funcțiile server cer plan cu plată |
| Poate fi testat local identic | ✅ (am rulat stiva completă local) | parțial | parțial |
| Limitare | proiectul Free intră în pauză după ~1 săptămână de inactivitate | — | — |

## Configurare de la zero (o singură dată)

### 1. Proiectul Supabase
1. https://supabase.com → **Start your project** → cont (GitHub sau e-mail).
2. **New project**:
   - Name: `life-rpg`;
   - Database Password: generează una puternică și **salvează-o** (ex. într-un manager de parole);
   - Region: **Central EU (Frankfurt)**, pentru utilizatori din RO/MD și pentru GDPR.
3. După crearea proiectului: **Project Settings → API**. Notează:
   - **Project URL**, de exemplu `https://abcdxyz.supabase.co`. Variabila GitHub `SUPABASE_URL`.
   - Cheia publică **anon** / **publishable**. Variabila GitHub `SUPABASE_ANON_KEY`. E publică prin design: regulile RLS protejează datele.
   - **Project Reference** (partea `abcdxyz`). Variabila GitHub `SUPABASE_PROJECT_REF`.
   - ⚠️ Cheia **service_role / secret** NU se pune nicăieri în aplicație.
4. **Account → Access Tokens → Generate new token**. Secretul GitHub `SUPABASE_ACCESS_TOKEN`.
5. Parola bazei de date devine secretul GitHub `SUPABASE_DB_PASSWORD`.

### 2. E-mailul (codurile de 6 cifre)
Serverul de e-mail implicit al Supabase trimite **doar** către membrii echipei proiectului, maximum 2 pe oră. Pentru utilizatori reali e obligatoriu un SMTP propriu.
1. Cumpără un domeniu (~10–15 €/an), de exemplu de la Cloudflare Registrar sau un registrar .ro.
2. https://resend.com → cont → **Domains → Add domain** → adaugă înregistrările DNS afișate → **Verify**. Planul gratuit permite 3.000 de e-mailuri pe lună și 100 pe zi.
3. **API Keys → Create** (permisiune Sending).
4. În Supabase: **Authentication → Emails → SMTP Settings → Enable custom SMTP**:
   - host `smtp.resend.com`, port `465`, user `resend`, parola = cheia API Resend;
   - sender `no-reply@domeniul-tău`, nume „LIFE RPG”.
5. **Authentication → Emails → Templates**: copiază conținutul din `life-rpg/supabase/templates/` la „Confirm signup”, „Reset password” și „Magic link”. Șabloanele afișează codul de 6 cifre, în trei limbi.
6. **Authentication → Providers → Email**:
   - Confirm email: **ON**;
   - Email OTP length: **6**;
   - Email OTP expiration: **3600**;
   - Minimum password length: **8**, cu litere și cifre.
7. **Authentication → URL Configuration**:
   - Site URL: `https://zc5pz8czvw-glitch.github.io/Tapo.github.io/life-rpg/web/`;
   - Redirect URLs: adaugă `capacitor://localhost`.

Pașii 5–7 se pot aplica și automat cu `supabase config push`, din `supabase/config.toml`, dacă instalezi Supabase CLI.

### 3. Cheia AI (Anthropic)
1. https://console.anthropic.com → cont → **Billing**: adaugă credit (minimum 5 $). Plătești doar ce se consumă.
2. **Limits**: setează o **limită lunară**, de exemplu 20 $. Dacă e atinsă, Mentorul trece automat pe răspunsuri locale; jocul nu se strică.
3. **API Keys → Create Key**. Secretul GitHub `ANTHROPIC_API_KEY`. Cheia nu ajunge niciodată în aplicație.

### 4. Publicarea backendului
GitHub → **Actions** → **Backend deploy** → **Run workflow**. Fluxul:
1. aplică migrațiile SQL (tabele, reguli RLS, funcții);
2. setează secretele funcției (cheia AI, modelul, limitele);
3. publică funcția `mentor`.

Rulează-l din nou după orice modificare din `supabase/`.

**Variabile opționale** (Settings → Variables): `AI_DAILY_FREE` (mesaje AI pe zi per utilizator, implicit 15), `AI_GLOBAL_DAILY` (plafonul total pe zi al serverului, implicit 3000, cam 1 $/zi cu Haiku), `AI_MODEL` (implicit `claude-haiku-5-5`).

### 5. Leagă aplicația de server
Adaugă variabilele GitHub `SUPABASE_URL`, `SUPABASE_ANON_KEY` și `SUPPORT_EMAIL`. Fluxul **iOS TestFlight** le pune automat în aplicație. Pentru site rulează `npm run site` cu valorile completate în `app/config.json`. Acolo pot sta: sunt publice.

## Administrare obișnuită (5–10 minute pe săptămână)

Toate operațiile de mai jos se fac în Supabase → **SQL Editor** → New query → lipești → **Run**.

**Raportări noi (nume sau răspunsuri AI):**
```sql
select r.id, r.created_at, r.kind, r.details, p.display_name as tinta, r.target_user
from public.reports r left join public.profiles p on p.id = r.target_user
where r.status = 'open' order by r.created_at;
```

**Rezolvarea unei raportări** (redenumește un nume ofensator și închide raportarea):
```sql
update public.profiles set display_name = 'Jucător' where id = '<target_user>';
update public.reports set status = 'actioned' where id = <id>;
-- sau, dacă raportarea nu e întemeiată:
update public.reports set status = 'dismissed' where id = <id>;
```

**Suspendarea unui cont abuziv** (nu mai poate folosi AI, salvarea în cont și clasamentul; jocul local merge în continuare):
```sql
update public.profiles set disabled = true where id = '<user_id>';
```

**Consumul AI** (azi și ultimele 30 de zile):
```sql
select day, count as mesaje, tokens_in, tokens_out, errors,
       round((tokens_in * 0.10 + tokens_out * 0.50) / 1e6, 3) as cost_estimat_usd
from private.ai_budget order by day desc limit 30;
```

**Erori raportate de aplicații** (ultimele 7 zile):
```sql
select app_version, platform, message, count(*) from public.client_errors
where created_at > now() - interval '7 days' group by 1,2,3 order by 4 desc limit 50;
```

**Numărul de jucători:**
```sql
select count(*) as conturi, count(*) filter (where created_at > now() - interval '7 days') as noi_7_zile from public.profiles;
```

**Curățenia automată**, cu `pg_cron`: zilnic se șterg erorile mai vechi de 30 de zile, consumul AI mai vechi de 60 de zile și raportările închise mai vechi de 180 de zile. Dacă `pg_cron` nu e activ (Database → Extensions → pg_cron → Enable), rulează manual `select private.cleanup();` o dată pe lună.

## Monitorizare și alerte
- **Supabase → Reports / Logs**: cereri, erori, funcția `mentor` (fiecare apel scrie o linie JSON cu durata, tokenii și codul de eroare, fără conținutul mesajelor).
- **Supabase → Usage**: MAU, spațiu, apeluri de funcții, raportate la limitele planului.
- **Anthropic Console → Usage**: costul AI. Limita lunară te protejează de surprize.
- **GitHub → Actions**: dacă o compilare eșuează, primești e-mail.
- Recomandare: Supabase → Organization → Billing → **Spend cap ON**, ca să nu existe facturi neașteptate.

## Ce se întâmplă când pică ceva (și cum îți revii)

| Situația | Ce vede jucătorul | Ce faci |
|---|---|---|
| Fără internet | jocul merge normal; salvarea în cont așteaptă și se trimite automat la revenire; Mentorul răspunde local | nimic |
| Supabase indisponibil | mesaj clar; datele rămân pe telefon; reîncercare automată | verifici status.supabase.com; aștepți |
| Proiectul Free „în pauză” (după inactivitate) | contul, prietenii și AI nu merg; jocul local merge | Supabase → **Restore project**; ca să nu se repete, treci pe Pro (25 $) |
| Credit AI terminat / limită atinsă | Mentorul răspunde local, cu un mesaj | adaugi credit sau aștepți luna următoare |
| Limita globală AI pe zi atinsă | „Mentorul AI e foarte solicitat azi”, apoi răspuns local | crești `AI_GLOBAL_DAILY` (Backend deploy) dacă bugetul permite |
| Furnizorul AI e jos | răspuns local + mesaj; cota zilnică nu se consumă | opțional schimbi `AI_PROVIDER` pe alt furnizor și rulezi Backend deploy |
| Conflict între două telefoane | dialog: „Folosește copia din cont” sau „Păstrează datele de aici” | nimic: nu se suprascrie nimic fără decizia jucătorului |
| Date corupte pe telefon | ecran de recuperare, cu import din copia de siguranță | nimic |
| Ștergere accidentală a datelor din baza de date | — | Pro are backup zilnic (7 zile): Database → Backups → Restore |

**Backup-uri:**
- Planul Pro face backup zilnic automat.
- Pe Free fă lunar un export: Database → Backups, sau `supabase db dump`.
- Jucătorii își pot exporta oricând progresul într-un fișier, din aplicație.

## Testare locală a backendului (fără cont Supabase)
```
cd life-rpg/supabase/local
./dc.sh up -d                    # Postgres, Auth, REST, funcții, e-mail de test, AI simulat
cd ../.. && node tools/apply-migrations.mjs
npm run test:backend             # 24 de teste
```
E-mailurile de test se văd la http://localhost:54324. AI-ul e simulat, deci nu costă nimic. Pentru un test cu AI real: `LOCAL_AI_BASE_URL= LOCAL_AI_KEY=sk-ant-... ./dc.sh up -d functions`.

## Actualizări și întreținere

| Ce | Cât de des | Cum |
|---|---|---|
| Moderare raportări | săptămânal | interogarea de mai sus |
| Verificare costuri (Supabase, Anthropic) | lunar | paginile Usage |
| Actualizări de securitate ale dependențelor | lunar | `npm audit` în `life-rpg/`; actualizezi și rulezi testele |
| Versiune nouă de Xcode/SDK cerută de Apple | anual (aprilie) | CI folosește automat ultimul Xcode stabil; urci o versiune nouă |
| Schimbarea modelului AI (model nou, mai ieftin) | când apare | variabila `AI_MODEL` → Backend deploy |
| Migrații noi de bază de date | la funcții noi | fișier nou în `supabase/migrations/` → Backend deploy |
