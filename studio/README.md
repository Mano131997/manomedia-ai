# ManoMedia Studio

Interne webapp om met het team AI-beelden en -video's te maken, in de stijl van Higgsfield:

- **Image**: prompt, model kiezen, formaat, aantal, referentiebeelden uploaden.
- **Video**: tekst of startbeeld naar video (5 of 10 sec).
- **Chat**: zoals ChatGPT, maar voor ontwerp. Beschrijf wat je wil, upload een foto, en stuur bij ("maak de achtergrond blauw"). Claude schrijft de prompt en maakt het beeld.
- **Galerij**: al het werk van het team, met zoeken en download.
- **Team** (admins): collega's toegang geven of intrekken, maandbudget per persoon, kosten per model.

Beelden en video's komen via de [Higgsfield API](https://docs.higgsfield.ai) (Seedream, FLUX Kontext, Kling), optioneel aangevuld met modellen van [fal.ai](https://fal.ai). De chat draait op Claude.
Zonder sleutels draait de app in **demo-modus**: placeholderbeelden, geen video, geen chat.

## Opstarten

Nodig: Node.js 20 of nieuwer.

```bash
cd studio
cp .env.example .env          # vul SESSION_SECRET, HF_KEY en ANTHROPIC_API_KEY in
npm install
npm run db:push               # maakt de database aan
npm run create-admin -- jij@manomedia.be "Jouw Naam" "een-sterk-wachtwoord"
npm run build && npm start    # of: npm run dev
```

Open http://localhost:3000 en log in. Collega's voeg je toe via **Team**.

### Sleutels

| variabele | waar te halen | waarvoor |
| --- | --- | --- |
| `SESSION_SECRET` | `openssl rand -hex 32` | inlogsessies |
| `HF_KEY` | cloud.higgsfield.ai → API keys, als `KEY_ID:KEY_SECRET` (prepaid tegoed) | beelden en video |
| `FAL_KEY` (optioneel) | fal.ai → Dashboard → Keys | extra modellen van fal.ai |
| `ANTHROPIC_API_KEY` | platform.claude.com → API keys | chat |

## Kosten

Elke generatie kost geld bij Higgsfield of fal.ai (per beeld of per seconde video) en de chat bij Anthropic (per token).
De app houdt per persoon een **schatting** bij in dollar; de bedragen per model staan in `src/lib/models.ts`.
Echte kosten zie je in de dashboards van Higgsfield, fal.ai en Anthropic. Zet een maandbudget per collega via **Team**.

## Techniek

- Next.js 15 (App Router) + TypeScript, Prisma, SQLite (één bestand, `prisma/studio.db`).
  Voor Postgres: zet `provider = "postgresql"` in `prisma/schema.prisma` en pas `DATABASE_URL` aan.
- Bestanden staan op schijf in `STORAGE_DIR` en worden alleen aan ingelogde gebruikers geserveerd.
- Modellen toevoegen of wisselen: `src/lib/models.ts` (endpoint en invoervelden staan op de API-pagina van elk model: docs.higgsfield.ai/docs/models of fal.ai/models). Alleen modellen waarvan de sleutel ingevuld is, verschijnen in de app.
- Generaties lopen asynchroon bij de provider (`src/lib/providers.ts`); de app vraagt de status op wanneer iemand de pagina open heeft.
- Chat: `src/lib/chat.ts`, Claude met één tool (`generate_image`) en de volledige gespreksgeschiedenis in de database.

## Online zetten

Draai het op een server of VPS met een vaste schijf (database en bestanden staan lokaal), achter HTTPS
(bv. Caddy of nginx). Serverless hosting zoals Vercel past niet zonder eerst opslag naar S3/R2 en de
database naar Postgres te verhuizen.
