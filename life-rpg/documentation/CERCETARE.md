# Cercetare: aplicații populare și decizii pentru LIFE RPG

Cercetarea a fost făcută în octombrie 2026 din surse publice. Cifrele marcate „estimare” vin din analize terțe (Sensor Tower, RevenueCat etc.), nu din date oficiale ale companiilor.

## Ce am învățat de la aplicațiile de succes

| Aplicația | Ce funcționează | Ce urăsc utilizatorii |
|---|---|---|
| **Duolingo** | Seria zilnică. „Streak Freeze”: a echipa 2 freeze-uri a crescut utilizatorii zilnici (+0,38%). Separarea seriei de obiectivul zilnic (+3,3% retenție la 14 zile). „Streak Revival” a readus ~8 mil. de utilizatori inactivi (estimare). Ligi săptămânale | Sistemul „energy” din 2025, perceput ca „cash grab”; ligile devenite greu de jucat fără abonament |
| **Finch** | Companion fără pedepse, obiective minuscule. Retenție estimată D1 54% / D7 37% | Oferte de abonament la instalare, înainte de a înțelege aplicația; „a început să mă streseze” |
| **Habitica** | RPG pentru obiceiuri; grupuri mici (party) cu boss comun | Pedepse (pierzi HP), interfață veche; chatul public a fost închis în 2023, grupurile mici au supraviețuit |
| **Fabulous** | Călătorii ghidate | Exemplu negativ: anulare grea, taxare după anulare, oferte ascunse |
| **Forest / Focus Friend** | Cronometru de concentrare cu ceva vizual care crește. Focus Friend a ajuns #1 în SUA în august 2025 | Abonament nou la Forest |
| **Tiimo** | App of the Year 2025: planificare calmă, vizuală, asistată de AI | — |
| **Todoist Karma** | Puncte, obiective zilnice, **zile libere și mod vacanță** | Penalizări pentru sarcini întârziate |
| **Streaks** | Plată unică, fără abonament, iubită de utilizatori | — |
| **Habitify** | — | „Doar 3 obiceiuri gratis” |
| **Do It Now / LifeRPG** | Sarcini legate de atribute | Puțin dezvoltate: **e loc pe piață pentru un RPG al vieții modern** |

## Ce am implementat din asta (și de ce)

| Mecanică | Inspirată de | Cum am adaptat-o fără să copiez | Ce am evitat |
|---|---|---|---|
| **Scuturi de serie** câștigate la fiecare 7 zile la rând, max. 2, folosite automat | Duolingo Streak Freeze | Se câștigă doar prin joc; scutul nu se irosește dacă pauza e prea lungă | Vânzarea scuturilor |
| **Zile libere** alese (max. 2 pe săptămână) | Todoist days off | Seria nu se rupe în zilele de odihnă; activitatea în acele zile contează normal | Seria „perfectă” care obligă |
| **Misiunea de revenire**: 3 zile active la rând recuperează seria, o dată la 30 de zile | Duolingo Streak Revival | Gratuită, cu recuperare reală a seriei vechi | Efectul „oricum am pierdut tot” |
| „Zi minimă”: o singură activitate reală ține seria | Duolingo, separarea seriei de obiectiv | Exista deja: revizuirea de 2 minute ține seria | — |
| **Praguri** la 7 / 30 / 100 / 365 de zile, cu sărbătorire | Duolingo Streak Society | Fără recompense cumpărabile | — |
| Prieteni prin cont + **Liga săptămânii opțională** | Habitica parties, ligile Duolingo | Implicit doar prieteni; Liga doar la cerere; raportare și blocare | Clasament public obligatoriu, „pay-to-win” |
| **Memento zilnic** opțional, max. 1 pe zi, oră aleasă, sare zilele active și zilele libere | — | Mesaj blând, fără vinovăție | Spam de notificări |
| Mentorul AI cu limită zilnică, ca bază a unui viitor Premium | Bearable, Tiimo | Gratuit cu limită; analize pe fapte | Paywall înainte de valoare |
| Boss Battle fără pedepse | Habitica | Exista deja: termenul depășit nu șterge XP | Pierderea de HP |

**Ce nu am adăugat:**
- widget pe ecranul principal: cere cod nativ Swift separat; e o idee bună pentru o versiune viitoare;
- integrarea cu Apple Health: cere permisiuni și o declarare suplimentară la Apple;
- companion animal.

Nu le-am adăugat doar pentru că există la alții: ar adăuga complexitate înainte de a ști ce iubesc primii utilizatori.

## Principii etice păstrate
- Fără pedepse pentru o zi pierdută, fără scuturi vândute, fără „energie” pe acțiunea principală.
- Nicio ofertă de plată la instalare. Monetizarea doar după ce aplicația și-a dovedit valoarea.
- Recompensele vin doar din activitate reală, cu dovezi. Mentorul spune sincer când datele sunt puține.
- Un studiu (CHI 2016) arată că seriile pot crea dependență de aplicație. De aceea zilele libere și mesajele normalizează odihna.

## Surse principale
- Duolingo: https://blog.duolingo.com/how-duolingo-streak-builds-habit · https://blog.duolingo.com/improving-the-streak
- Finch (estimări): https://www.deconstructoroffun.com/blog/x0hd2ssr80y5n7gv0w967pg7hwd7tl
- Habitica: https://habitica.fandom.com/wiki/Tavern_and_Guild_Shutdown_FAQ
- Todoist Karma: https://todoist.com/help/articles/introduction-to-karma-OgWkWy
- Apple App Store Awards 2025: https://www.businesswire.com/news/home/20251204519906/en/Apple-unveils-the-winners-of-the-2025-App-Store-Awards
- RevenueCat, State of Subscription Apps: https://www.revenuecat.com/state-of-subscription-apps
- Cerințele Apple: vezi PUBLICARE-APP-STORE.md
