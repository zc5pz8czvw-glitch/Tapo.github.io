# Publicarea în Apple App Store

Informații verificate în documentația oficială Apple la 24 octombrie 2026. Linkurile sunt la sfârșit. Regulile Apple se schimbă des, așa că verifică pagina de reguli înainte de trimitere: https://developer.apple.com/app-store/review/guidelines/

## 1. Cum ajunge jocul să fie o aplicație iOS

Jocul e o aplicație web (HTML/JS). Îl împachetez cu **Capacitor 8**, care produce un proiect Xcode real (`life-rpg/ios`). Apple respinge des aplicațiile care sunt doar un site împachetat (regula **4.2**, „funcționalitate minimă”). Aplicația noastră trece de acest risc pentru că:
- tot jocul e inclus în aplicație și merge **fără internet**; nu încarcă un site de pe server;
- are funcții de telefon: memento-uri locale (notificări), ecran de pornire nativ, salvare locală, partajarea copiei de siguranță;
- are conținut și interacțiune bogate: misiuni, abilități, Mentor, clasament.

**Verificat:** proiectul iOS se compilează cu Xcode 26.6 și SDK-ul iOS 26.5 pe Mac-urile GitHub („BUILD SUCCEEDED”). Apple cere acum Xcode 26 sau mai nou; din aprilie 2027 va cere SDK-ul iOS 27. Compilarea se face pe Mac-uri GitHub gratuite (repository public), deci **nu ai nevoie de un Mac**.

**Opțiuni comparate:**

| Variantă | Avantaje | Dezavantaje | Ales? |
|---|---|---|---|
| Capacitor (web + container nativ) | Păstrează tot jocul existent; un singur cod pentru iOS, web și, mai târziu, Android | Unele lucruri native (widget-uri) cer cod Swift separat | ✅ |
| Rescriere nativă (Swift/SwiftUI) | Performanță și integrare maxime | Luni de muncă; jocul ar trebui refăcut de la zero | ❌ |
| React Native / Flutter | Componente native | Tot o rescriere aproape completă | ❌ |
| Doar PWA (fără App Store) | Gratuit, imediat | Nu apare în App Store; pe iOS are limitări | Ca bonus: e deja gata |

## 2. Cerințe Apple și cum sunt îndeplinite

| Regula | Ce cere | Stare în LIFE RPG |
|---|---|---|
| 4.2 Funcționalitate minimă | Mai mult decât un site împachetat | ✅ joc complet, offline, notificări locale |
| 5.1.1(v) Cont | Fără funcții esențiale de cont, aplicația trebuie să meargă fără login; dacă există creare de cont, **trebuie ștergerea contului în aplicație** | ✅ jocul merge fără cont; Profil → Cont și sincronizare → Șterge contul definitiv (șterge tot de pe server) |
| 4.8 Autentificare | „Sign in with Apple” (sau o alternativă echivalentă) e obligatoriu doar dacă folosești login de la terți (Google, Facebook) | ✅ doar e-mail și parolă proprii, deci nu e necesar |
| 5.1.2(i) AI de la terți | Trebuie spus clar că datele merg la un AI terț și trebuie cerut **acord explicit** înainte | ✅ ecran de acord înainte de primul mesaj AI, numește furnizorul; acordul se poate retrage |
| 1.2 / 4.7 Conținut generat | Filtrare, raportare, blocare, date de contact publicate | ✅ filtru de nume pe server, „Raportează” la nume și la răspunsuri AI, blocare jucători, e-mail de suport |
| 5.1.1(i) Confidențialitate | Link la politica de confidențialitate în App Store Connect **și** în aplicație | ✅ Profil → Politica de confidențialitate; pagina e în `web/privacy.html` |
| 1.4.1 Sănătate | Fără pretenții medicale | ✅ Mentorul spune explicit că nu e specialist; în crize trimite la 112 |
| 2.1 Completitudine | Cont demo pentru verificatori; serverul pornit | ⚠️ la trimitere: creezi un cont demo (pasul 7) |
| 4.5.4 Notificări | Nu pot fi obligatorii | ✅ memento opțional, oprit implicit |
| 3.1.1 / 3.1.2 Cumpărături | Funcțiile plătite doar prin In-App Purchase, cu preț clar | ✅ momentan totul e gratuit |
| Privacy manifest | `PrivacyInfo.xcprivacy`, plus manifestele SDK-urilor (Capacitor e pe lista Apple) | ✅ inclus în proiect; Capacitor 8 vine cu manifestul propriu |
| Criptare (export) | Declarație de criptare | ✅ `ITSAppUsesNonExemptEncryption = false` (doar HTTPS standard) |

## 3. Pașii, unul câte unul

### Pasul 1 — Apple Developer Program (💶 99 $/an, obligatoriu)
https://developer.apple.com/programs/enroll/ → **Start Your Enrollment** → **Individual / Sole Proprietor**.
- Ai nevoie de un cont Apple cu autentificare în doi pași, numele legal real (apare public ca vânzător), adresa și un card.
- Persoanele fizice nu au nevoie de numărul D-U-N-S.
- Pentru persoane fizice nu există scutire de taxă.

### Pasul 2 — Creează aplicația în App Store Connect
https://appstoreconnect.apple.com → **Apps** → **+** → **New App**:

| Câmp | Valoare |
|---|---|
| Platform | iOS |
| Name | **LIFE RPG** (sau varianta de rezervă) |
| Primary Language | Romanian (sau English, dacă vrei piață largă) |
| Bundle ID | `com.tapo.liferpg`. Dacă nu apare în listă: developer.apple.com → Certificates, IDs & Profiles → Identifiers → + → App IDs → App, Explicit `com.tapo.liferpg` |
| SKU | `liferpg-001` |

### Pasul 3 — Cheia API pentru urcarea automată (fără Mac)
App Store Connect → **Users and Access** → **Integrations** → **App Store Connect API** → **Team Keys** → **+** → nume „GitHub”, rol **App Manager** → descarcă fișierul `.p8`. Se poate descărca o singură dată, deci păstrează-l.

Pe GitHub: repository → **Settings** → **Secrets and variables** → **Actions**:

| Tip | Nume | Valoare |
|---|---|---|
| Secret | `APPLE_API_KEY_ID` | Key ID (ex. `ABC123DEFG`) |
| Secret | `APPLE_API_ISSUER_ID` | Issuer ID (deasupra listei de chei) |
| Secret | `APPLE_API_KEY_P8` | tot conținutul fișierului `.p8`, inclusiv liniile BEGIN/END |
| Secret | `APPLE_TEAM_ID` | Team ID (developer.apple.com → Membership details) |
| Variable | `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPPORT_EMAIL` | vezi BACKEND-SI-ADMINISTRARE.md |

Creează și un **Environment** numit `production` (Settings → Environments → New environment). Fluxurile de lucru îl folosesc.

### Pasul 4 — Prima versiune în TestFlight
GitHub → **Actions** → **iOS TestFlight** → **Run workflow**. În aproximativ 10–20 de minute versiunea apare în App Store Connect → TestFlight. Ea trece printr-o procesare scurtă la Apple.
- **Testare internă**: până la 100 de membri ai echipei, fără verificare.
- **Testare externă**: până la 10.000 de persoane prin link public. Prima versiune trece printr-o verificare „Beta App Review”, deci completezi o descriere scurtă și un e-mail de feedback.

### Pasul 5 — Pagina din App Store

**Capturi de ecran.** Sunt gata în `store/screenshots/<limbă>/`, în format PNG fără transparență:
- `6.9in-1320x2868/`, pentru iPhone mare (opțional, dar recomandat);
- `6.3in-1206x2622/`, dimensiunea obligatorie acum („Dynamic Island medium”).

Încarcă 5–7 capturi pentru fiecare limbă. Aplicația e doar pentru iPhone, deci nu trebuie capturi de iPad. Atenție: din aprilie 2027 Apple va cere și capturi pentru iPhone Duo. Le generez atunci cu `npm run screenshots`.

**Iconița** (1024×1024, fără transparență) e deja în proiect.

**Texte** (limitele Apple: nume 30 de caractere, subtitlu 30, cuvinte-cheie 100 de bytes, text promoțional 170, descriere 4000):

**Română**
- Nume: `LIFE RPG`
- Subtitlu: `Misiuni reale, XP și niveluri` (29)
- Cuvinte-cheie: `obiceiuri,rutina,productivitate,motivatie,disciplina,habit,joc,nivel,serie,mentor,ai,focus` (≤100)
- Text promoțional: `Transformă viața reală într-un RPG: misiuni, XP, abilități și un Mentor care îți spune sincer ce merge și ce nu. Gratuit, fără reclame.`
- Descriere:
```
LIFE RPG transformă activitățile tale reale în misiuni, XP și niveluri.

• Misiuni zilnice, principale și Boss Battle-uri cu etape
• XP corect: primești puncte doar pentru ce faci și poți dovedi
• Arbore de abilități cu 6 atribute: Minte, Corp, Disciplină, Business, Comunicare, Independență
• Seria zilelor active, cu Scuturi câștigate prin joc, zile libere și misiunea de revenire. Fără pedepse, fără cumpărături
• Focus: sesiuni cronometrate cu reflecție
• Revizuirea zilei și Reality Check: planificat vs. realizat
• Mentorul: analize sincere ale progresului tău (local, gratuit; opțional Mentor AI cu cont)
• Prieteni, clasament și Liga săptămânii (opțional)
• Funcționează fără internet; contul e opțional
• Română, English, Русский

Fără reclame. Fără urmărire. Datele tale rămân ale tale.
```

**English**
- Name: `LIFE RPG` · Subtitle: `Real quests, XP and levels` (26)
- Keywords: `habit,tracker,routine,productivity,motivation,discipline,goals,rpg,level,streak,mentor,ai,focus`
- Promotional text: `Turn your real life into an RPG: quests, XP, skills and a Mentor that tells you honestly what works. Free, no ads.`
- Description: the Romanian text above translated literally.

**Русский**
- Название: `LIFE RPG` · Подзаголовок: `Реальные миссии, XP и уровни` (28)
- Ключевые слова: `привычки,трекер,мотивация,цели,rpg,уровень,серия,habit` (93 bytes; literele chirilice ocupă câte 2 bytes, iar limita Apple e de 100)

**URL-uri:**
- Support URL: `https://zc5pz8czvw-glitch.github.io/Tapo.github.io/life-rpg/web/support.html`
- Privacy Policy URL: `https://zc5pz8czvw-glitch.github.io/Tapo.github.io/life-rpg/web/privacy.html`
- Marketing URL (opțional): `https://zc5pz8czvw-glitch.github.io/Tapo.github.io/life-rpg/web/`

**Categorie:** Primary **Productivity** · Secondary **Lifestyle**. Am evitat intenționat „Health & Fitness” și „Medical”, care cer declarații suplimentare privind dispozitivele medicale.

**Copyright:** `2026 <numele tău>`

### Pasul 6 — Chestionarele

**Age Rating.** Apple cere și întrebările noi despre social media, obligatorii din septembrie 2026. Răspunsuri recomandate:
- Violență, conținut sexual, limbaj vulgar, droguri, jocuri de noroc: **None**
- Medical/Treatment Information: **None** (Mentorul nu dă informații medicale)
- User-Generated Content: **Yes** (numele de jucător, vizibile prietenilor și în Ligă)
- Messaging and Chat: **No** (jucătorii nu își trimit mesaje între ei; chatul e doar cu Mentorul)
- Social media / feed public de conținut: **No**
- Unrestricted web access: **No**
- AI / chatbot: dacă apare întrebarea, răspunde **Yes** (Mentorul AI cu conținut filtrat)

Rezultat așteptat: **9+ sau 13+**. Recomand să alegi manual **„Override to Higher Age Rating” → 13+**, ca să fie în acord cu termenii: contul e de la 16 ani, iar Mentorul AI e un chat.

**App Privacy (eticheta de confidențialitate):**
- Data used to track you: **No**
- Data linked to you, toate cu scopul **App Functionality** și fără tracking:
  - Contact Info → **Email Address**
  - Identifiers → **User ID**
  - User Content → **Gameplay Content** (progresul salvat) și **Other User Content** (mesajele către Mentor și textul revizuirilor din copia salvată)
  - Diagnostics → **Crash Data / Other Diagnostic Data** (erorile trimise de aplicație)
- Nu colectezi: locație, contacte, sănătate, date financiare, istoric de navigare, reclame.

**Export Compliance:** aplicația folosește doar HTTPS standard, deci răspunzi **No** la algoritmi de criptare proprii. Declarația e deja în Info.plist.

**EU Digital Services Act:**
- Cât timp aplicația e gratuită și nu acționezi profesional, poți alege „This is not a trader account”.
- Dacă vinzi abonamente, vei fi probabil comerciant. Atunci adresa, telefonul și e-mailul tău devin publice pe pagina din UE.

### Pasul 7 — Note pentru verificatorii Apple (App Review Information)

Creează din aplicație un cont demo, de exemplu `review@<domeniul tău>`, confirmă codul și joacă puțin, ca să existe progres. Completează:
- **Sign-in required:** No (jocul merge fără cont), dar oferă contul demo.
- **Username / Password:** contul demo.
- **Notes**, în engleză:
```
LIFE RPG works fully without an account (local play, local rule-based mentor).
An optional account (email + password, 6-digit email code) adds cloud save, friends/leaderboard and the AI Mentor.
Demo account: <email> / <password> (already confirmed).
AI Mentor: before the first AI request the app shows an explicit consent screen naming the provider (Anthropic).
Report/Block: Progress → Leaderboard → "..." next to a player. AI answers have a "Report" link.
Account deletion: Profile → Account & sync → Delete account permanently.
Daily reminders are optional and off by default (Profile → Notification settings).
```

### Pasul 8 — Trimiterea
Versiunea iOS → **Build**: alegi versiunea din TestFlight → **Add for Review** → **Submit**. Răspunsul vine de obicei în 1–3 zile. Dacă e o respingere, copiază-mi mesajul și corectez.

## 4. Actualizări după publicare
1. Modificările de cod se fac pe o ramură; CI-ul verifică build-ul și compilarea iOS.
2. Crești versiunea în `life-rpg/package.json` și în proiectul iOS (`MARKETING_VERSION`).
3. Rulezi **iOS TestFlight**. Numărul build-ului crește automat.
4. Testezi în TestFlight → App Store Connect → versiune nouă (+) → alegi build-ul → Submit.

## Surse oficiale
- Reguli App Review: https://developer.apple.com/app-store/review/guidelines/ (4.2, 4.7, 4.8, 5.1.1, 5.1.2, 1.2, 1.4, 3.1)
- Actualizarea despre AI de la terți (13 noi. 2025): https://developer.apple.com/news/?id=ey6d8onl
- Cerințe viitoare (Xcode, SDK, vârstă): https://developer.apple.com/news/upcoming-requirements/
- Clasificarea pe vârste: https://developer.apple.com/help/app-store-connect/reference/app-information/age-ratings-values-and-definitions/
- Capturi de ecran: https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications
- Etichete de confidențialitate: https://developer.apple.com/app-store/app-privacy-details/
- SDK-uri care cer manifest: https://developer.apple.com/support/third-party-SDK-requirements/
- DSA (UE): https://developer.apple.com/help/app-store-connect/manage-compliance-information/manage-european-union-digital-services-act-trader-requirements
- Small Business Program: https://developer.apple.com/app-store/small-business-program/
- Înscriere: https://developer.apple.com/programs/enroll/
- TestFlight: https://developer.apple.com/testflight/
