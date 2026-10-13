# Recon map: Higgsfield-achtige studio (web)

Scope: één interne studio om afbeeldingen en video's te genereren, met de
interface-stijl van Higgsfield (prompt + modelkiezer + galerij) en een
chat-modus zoals ChatGPT om een ontwerp in gesprek te maken en bij te sturen.
Uploaden (referentiebeelden) en downloaden van resultaten.
For: intern gebruik bij ManoMedia, plus collega's die toegang krijgen van een admin.
Date: 2026-10-13

## Bronnen

| # | bron | URL | notities |
| --- | --- | --- | --- |
| 1 | Higgsfield feature-gids 2026 (eigen site) | https://geo.higgsfield.ai/higgsfield-ai-features-full-guide-2026 | modellen, Cinema Studio, Soul ID, Apps |
| 2 | Higgsfield API (eigen blog) | https://higgsfield.ai/blog/higgsfield-api | officiële API, prijs per beeld / per seconde |
| 3 | Review + prijzen | https://www.eesel.ai/blog/higgsfield-ai | plannen, limieten |
| 4 | Vergelijking met Runway | https://blog.segmind.com/higgsfield-ai-vs-runway-key-differences/ | positionering |
| 5 | API-prijzen (derde partij) | https://www.mindstudio.ai/blog/higgsfield-api-pricing-pay-per-use/ | prepaid saldo, $5 minimum |
| 6 | Eigen account van de gebruiker | (screenshots nog aan te leveren) | **ontbreekt nog**: de exacte schermindeling |

Let op: de site higgsfield.ai was vanuit deze omgeving niet bereikbaar. De
schermen hieronder zijn afgeleid uit publieke beschrijvingen en zijn deels
**gok**. Screenshots uit het eigen account in `replica/screens/` maken dit exact.

## Core loop

Prompt typen (eventueel met referentiebeeld) → model en instellingen kiezen →
genereren → resultaat bekijken, opnieuw proberen of downloaden.

## Schermen

| ID | scherm | route | doel | componenten | states |
| --- | --- | --- | --- | --- | --- |
| S01 | Inloggen | /login | toegang voor uitgenodigde collega's | e-mail/Google-knop | fout, geen uitnodiging |
| S02 | Image-studio | /image | beeld genereren | promptbalk, modelkiezer, instellingen, upload, resultaatraster | leeg, bezig, klaar, fout |
| S03 | Video-studio | /video | video genereren (tekst of startbeeld) | promptbalk, startbeeld-upload, duur, beeldverhouding, model | leeg, in wachtrij, bezig (minuten), klaar, fout |
| S04 | Chat-studio | /chat | ontwerp in gesprek maken (ChatGPT-stijl) | berichtenlijst, invoer met upload, beelden in de chat, downloadknop | leeg, AI typt, beeld wordt gemaakt, fout |
| S05 | Galerij / historiek | /library | alles terugvinden | raster, filters (type, model, persoon), zoeken | leeg, gevuld, laden |
| S06 | Detailweergave | /library/:id | één resultaat bekijken | groot beeld/videospeler, prompt, instellingen, download, hergebruik, upscale | — |
| S07 | Team & toegang (admin) | /admin/users | collega's uitnodigen / verwijderen | tabel, uitnodigingsformulier, rol | leeg, gevuld |
| S08 | Verbruik (admin) | /admin/usage | kosten per persoon en per model | tabel, totalen, budgetlimiet | leeg, gevuld |

## Flows

```
F01 Afbeelding maken en downloaden
    S02 prompt -> model kiezen -> genereren -> S06 -> download
    happy path clicks: 3
    edge: prompt geweigerd door model, API-fout, leeg saldo, 4 varianten tegelijk

F02 Video maken van een afbeelding
    S02/S05 kies beeld -> "Maak video" -> S03 (beeld staat klaar) -> duur kiezen -> genereren -> wachten -> download
    happy path clicks: 4
    edge: job duurt 5+ min (pagina sluiten en later terugkomen), mislukte job, grote upload

F03 Ontwerp maken via chat
    S04 "maak een poster voor..." -> AI maakt beeld -> "maak de achtergrond blauw" -> nieuw beeld -> download
    happy path clicks: 2 berichten + 1 download
    edge: eigen foto uploaden en laten aanpassen, lange gesprekken, beeld hergebruiken in video-studio

F04 Collega toegang geven
    S07 e-mail invullen -> uitnodiging -> collega logt in via S01
    happy path clicks: 2
    edge: toegang intrekken, collega met verkeerd e-mailadres

F05 Werk terugvinden
    S05 filter op video / persoon -> S06
```

## Componenten

| component | varianten | states | gebruikt op |
| --- | --- | --- | --- |
| Promptbalk | image, video, chat | leeg, typen, verzenden, uitgeschakeld | S02 S03 S04 |
| Modelkiezer | dropdown met badges (prijs, snelheid) | open, gekozen | S02 S03 |
| Instellingenpaneel | beeldverhouding, resolutie, duur, aantal | — | S02 S03 |
| Upload-zone | drag & drop, knop | leeg, uploaden, voorbeeld, fout (te groot) | S02 S03 S04 |
| Resultaatkaart | beeld, video | in wachtrij, bezig (voortgang), klaar, fout | S02 S03 S05 |
| Mediaraster | masonry | laden, leeg, gevuld | S05 |
| Videospeler | — | laden, spelen | S06 |
| Chatbericht | gebruiker, AI, AI met beeld | typen, klaar | S04 |
| Zijbalk-navigatie | Image, Video, Chat, Galerij, Admin | actief | alle |
| Toast | succes, fout | — | alle |

## Afgeleid datamodel

```
User        id, email, name, role (admin|member), budget_cents, active
            evidence: eigen eis (interne toegang) — confidence: high
Generation  id, user_id, type (image|video), model, prompt, settings (json),
            input_asset_id?, status (queued|running|done|failed),
            provider_job_id, cost_cents, created_at
            evidence: bron 1, 2 (async jobs, prijs per beeld/seconde) — confidence: high
Asset       id, user_id, kind (upload|output), mime, storage_key, width, height, duration
            evidence: upload/download-eis — confidence: high
Conversation id, user_id, title
Message     id, conversation_id, role (user|assistant), text, asset_ids[]
            evidence: ChatGPT-chatmodus — confidence: high
Folder      id, name, owner_id   — confidence: guess (should)
```

Relaties: User 1-n Generation, Generation n-1 Asset (input), Generation 1-n Asset (output),
User 1-n Conversation, Conversation 1-n Message.

## Feature matrix

Zie `features.csv`. Must: 12, should: 7, could: 3, skip: 4.

## Buiten scope

- De eigen modellen van Higgsfield (Soul, Cinema Studio): die zijn hun eigendom.
  We gebruiken modellen via officiële API's met onze eigen sleutel
  (bijv. de Higgsfield API, fal.ai, Replicate, OpenAI, Google).
- Hun presetbibliotheek, voorbeeldvideo's, logo en teksten.
- Community-feed en abonnementen: niet nodig voor intern gebruik.

## Grootte

Schermen 8, flows 5, entiteiten 6. Moeilijke delen:
1. Video-jobs duren minuten: wachtrij, status bijhouden, terugkomen na sluiten.
2. Chat-modus: een taalmodel dat zelf de image-tool aanroept en beelden bijstuurt.
3. Kosten: elke generatie kost geld per beeld/seconde, dus verbruik en limieten per collega.

Size: **M** (enkele weken) voor de must-haves.
