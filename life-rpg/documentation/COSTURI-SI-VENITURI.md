# Costuri, lansare și venituri

Prețurile sunt verificate la 24 octombrie 2026 din paginile oficiale sau din documentația furnizorilor (sursele sunt la final). Pot apărea taxe locale (TVA). Unde o cifră nu a putut fi verificată direct, scrie „neverificat”.

## 1. Costuri obligatorii

| Ce | Cost | Când |
|---|---|---|
| Apple Developer Program | **99 $/an** (prețul local, cu taxe; fără scutire pentru persoane fizice) | înainte de TestFlight |
| Domeniu (necesar pentru trimiterea e-mailurilor cu coduri) | **~10–15 €/an** (.com sau .ro; neverificat exact) | înainte de lansarea conturilor |
| Credit AI Anthropic | **minimum 5 $** preplătit; apoi consumul | înainte de a activa Mentorul AI |

Fără domeniu și fără AI, jocul poate fi lansat și **fără conturi**: atunci rămâne doar Apple, 99 $/an. Pierzi însă salvarea în cont, prietenii și Mentorul AI.

## 2. Costuri lunare, pe etape

Presupuneri:
- un mesaj AI are ~1.500 de tokeni intrare și ~350 ieșire;
- 30% dintre utilizatorii activi folosesc AI 2 mesaje pe zi;
- Claude Haiku 5.5 costă 0,10 $ / 1M tokeni intrare și 0,50 $ / 1M tokeni ieșire.

Rezultă **≈ 0,000325 $ pe mesaj** (o treime de miime de dolar).

| | 100 utilizatori/lună | 1.000 utilizatori/lună | 10.000 utilizatori/lună |
|---|---|---|---|
| Mesaje AI pe lună | ~1.800 | ~18.000 | ~180.000 |
| AI (Haiku 5.5) | **~0,60 $** | **~6 $** | **~59 $** |
| Supabase | 0 $ (Free; risc de pauză) sau 25 $ (Pro) | **25 $** (Pro, recomandat) | **25 $** (Pro; în limitele incluse) |
| E-mail (Resend) | 0 $ (3.000/lună, 100/zi) | 0 $ | ~20 $ (Pro, dacă depășești 100 pe zi) |
| Domeniu (lunar) | ~1 $ | ~1 $ | ~1 $ |
| Apple (lunar, din 99 $/an) | ~8 $ | ~8 $ | ~8 $ |
| GitHub (compilare iOS, site) | 0 $ (repository public) | 0 $ | 0 $ |
| **Total aproximativ** | **~10 $** (sau ~35 $ cu Pro) | **~40 $** | **~115 $** |

Comparativ, cu un model AI mai puternic (Claude Sonnet 5.5, ~20× mai scump): ~12 $ / ~117 $ / ~1.170 $ doar pentru AI. De aceea modelul implicit e Haiku, cu limită zilnică. Sonnet ar avea sens doar pentru un plan Premium.

**Protecții de cost deja construite:**
- 15 mesaje AI pe zi per utilizator, gratuit;
- cel mult 6 mesaje pe minut;
- o singură cerere AI în curs per utilizator;
- un plafon global pe zi (implicit 3.000 de mesaje, ~1 $/zi);
- limita lunară din consola Anthropic;
- spend cap în Supabase.

**Notă despre repository-ul public:** compilarea iOS pe Mac-urile GitHub e gratuită doar pentru repository-uri publice. Dacă îl faci privat, ai 2.000 de minute pe lună la planul gratuit, dar minutele de macOS se consumă de ~10 ori mai repede (aprox. 200 de minute de Mac). O compilare durează ~5–15 minute. Codul public nu conține secrete.

## 3. Lansare realistă

1. **Săptămânile 1–2, TestFlight.** 20–50 de oameni (prieteni, grupuri de productivitate). Măsori câți revin a doua zi (D1) și după o săptămână (D7). Repere din industrie, estimate: aplicații bune de obiceiuri ~50% D1 și ~35% D7.
2. **Corectezi** ce nu e clar în primele 5 minute (onboarding), pe baza feedbackului.
3. **Lansarea în App Store**, gratuită, fără reclame, în RO/MD, plus EN și RU (piețe mari: UE, Ucraina, Kazahstan, comunități vorbitoare de rusă).
4. **Promovare cu buget mic:**
   - clipuri scurte TikTok / Instagram Reels / YouTube Shorts de tipul „îmi joc viața ca un RPG, ziua 1…30”: arată progresul real, nivelurile, seria;
   - postări în comunități de productivitate și auto-dezvoltare, fără spam;
   - pagina din App Store optimizată: cuvinte-cheie, primele 3 capturi clare;
   - invitațiile între prieteni (codul de prieten) aduc creștere organică.
5. **Ce să urmărești:** utilizatori noi pe zi, D1/D7, câți își fac cont, câți folosesc Mentorul AI, costul AI pe utilizator.

## 4. Monetizare: opțiuni compatibile cu regulile Apple

| Model | Cum | Avantaje | Riscuri |
|---|---|---|---|
| **Freemium + abonament Premium** (recomandat, după validare) | Joc complet gratuit. Premium (~2,99 $/lună sau ~24,99 $/an, cu preț regional) aduce: mai multe mesaje AI pe zi (120), AI mai puternic (Sonnet) pentru analize, statistici avansate, teme și avataruri | Gratuitul aduce utilizatori și recomandări; Premium acoperă costul AI | Conversie mică (în Health & Fitness, mediana e ~3% din descărcări, estimat). Aplicațiile cu AI pierd abonați mai repede |
| Cumpărare unică „Pro” | 5–10 $ o singură dată | Simplu, apreciat (ex. Streaks) | Nu acoperă costul AI recurent; ar trebui fără AI nelimitat |
| Reclame | — | — | **Nerecomandat**: strică încrederea și experiența, plus obligații de confidențialitate (tracking) |
| Donații / „tip jar” prin IAP | Opțional | Fără presiune | Venit mic |

**Reguli Apple de respectat** (3.1.1 / 3.1.2):
- conținutul digital se vinde doar prin In-App Purchase;
- prețul trebuie să fie elementul cel mai vizibil; perioada de probă e secundară;
- trebuie spus clar ce primești, plus linkuri la Termeni și Confidențialitate și explicația despre anulare.

**Fără tactici manipulatoare:**
- nu vinde scuturi de serie și nu pune „energie” pe acțiunea principală;
- nu arăta oferta înainte ca omul să înțeleagă aplicația; ofer-o după prima săptămână.

**Comisioane:** Apple ia 15% prin Small Business Program (venit sub 1 milion $/an); după primul an de abonament se aplică reduceri suplimentare. RevenueCat, opțional pentru gestionarea abonamentelor, e gratuit până la 2.500 $ venit lunar, apoi 1%.

**Ce e pregătit tehnic:**
- serverul are deja planul `premium` (`profiles.plan`, `plan_until`) și limitele AI diferite pe plan;
- lipsește doar partea de cumpărare în aplicație (StoreKit) și confirmarea cumpărăturii pe server (un webhook RevenueCat sau App Store Server Notifications). Le pot implementa când decizi, după ce semnezi Paid Apps Agreement.

**Condiții să conteze venitul:** retenție bună (D7 > 25–30%), câteva mii de utilizatori activi și promovare constantă. **Nu presupune venituri la început.** Primul obiectiv realist e ca aplicația să fie folosită și iubită. Costurile până la 1.000 de utilizatori (~40 $/lună) sunt mici și se pot susține și fără venit.

## Surse
- Prețuri Claude: https://platform.claude.com/docs/en/about-claude/pricing · Limite: https://platform.claude.com/docs/en/api/rate-limits · Păstrarea datelor: https://privacy.claude.com/en/articles/7996866-how-long-do-you-store-my-organization-s-data
- Supabase, facturare și limite: https://github.com/supabase/supabase/blob/master/apps/docs/content/guides/platform/billing-on-supabase.mdx · SMTP: https://github.com/supabase/supabase/blob/master/apps/docs/content/guides/auth/auth-smtp.mdx
- Resend: https://resend.com/pricing · RevenueCat: https://www.revenuecat.com/pricing
- GitHub Actions, cote: https://github.com/github/docs/blob/main/data/reusables/billing/actions-included-quotas.md
- Apple Small Business Program: https://developer.apple.com/app-store/small-business-program/
- Repere de conversie: RevenueCat „State of Subscription Apps” 2025/2026 (cifre din rezumate secundare)
