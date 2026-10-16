# CLAUDE.md

Reguli de utilizare pentru Claude în acest repository.

## Reguli principale

Aceste reguli au prioritate față de toate celelalte.

1. Nu șterge nimic fără permisiunea mea.
2. Vorbește cu mine în limba română, cu un limbaj simplu.
3. Înainte să începi ceva, arată-mi ce vrei să faci.
4. După fiecare lucru creat, explică-mi pe scurt ce ai făcut.
5. Dacă nu ești sigur, întreabă-mă. Nu inventa.

## Despre utilizator

- Numele: Gabs.
- Lucrează de pe telefon. Nu se pricepe la calculatoare, dar se pricepe la telefoane.
- Explicațiile se dau scurt și clar. Detalii doar când le cere.
- Scopul: să facă bani online. Site-ul poate deveni un business, dar planul nu e încă clar. Propune idei, dar întreabă înainte să alegi o direcție.
- Vizitatorii site-ului: încă nestabiliți.

## Stilul preferat

- Aspect foarte profesional și bine organizat.
- Animații plăcute.
- Culorile se aleg după scopul site-ului, ținând cont de ce transmite fiecare culoare.

## Livrare

- Când ceva e gata, trimite-i și fișierul în aplicație, ca să-l poată salva pe telefon.

## Despre proiect

- `Tapo.github.io` este un site static găzduit pe **GitHub Pages**.
- Fișierele din rădăcina ramurii `main` sunt publicate direct pe site.
- Nu există pas de build: HTML, CSS și JavaScript se scriu direct, fără framework-uri, dacă nu se cere explicit altceva.

## Limba

- Răspunde utilizatorului în **limba română**.
- Textul vizibil pe site se scrie în română, cu diacritice corecte (ă, â, î, ș, ț).
- Numele de fișiere, variabilele și comentariile din cod se scriu în engleză.

## Structura fișierelor

- `index.html` – pagina principală.
- `css/` – fișiere de stil.
- `js/` – scripturi.
- `assets/` sau `images/` – imagini și alte resurse.
- Numele fișierelor se scriu cu litere mici, cuvintele separate prin cratimă (ex: `despre-noi.html`).

## Reguli de cod

- HTML semantic (`header`, `main`, `section`, `footer`) și valid.
- Fiecare pagină are `<meta charset="utf-8">`, `<meta name="viewport">` și un `<title>` descriptiv.
- Site-ul trebuie să arate bine pe telefon (design responsive).
- Imaginile au atribut `alt` și sunt optimizate ca dimensiune.
- Folosește căi relative pentru linkuri și resurse, ca site-ul să funcționeze pe GitHub Pages.
- Fără biblioteci externe inutile; dacă e nevoie de una, se încarcă de pe un CDN cu versiune fixă.

## Securitate și confidențialitate

- Nu adăuga niciodată parole, chei API, tokenuri sau date personale în repository – tot ce e aici este public.
- Nu introduce formulare care colectează date sensibile.

## Git și lucrul cu modificările

- Mesajele de commit sunt scurte și clare, la imperativ (ex: „Adaugă pagina de contact”).
- Fă commit și push doar când utilizatorul cere explicit.
- Nu șterge și nu suprascrie fișiere existente fără confirmare.
- Nu face force-push pe `main`.
- Creează un pull request doar dacă utilizatorul îl cere.

## Înainte de a termina o modificare

- Verifică că linkurile și căile către fișiere sunt corecte.
- Verifică că pagina se deschide fără erori în consola browserului.
- Explică pe scurt ce s-a schimbat și în ce fișiere.
