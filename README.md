# Manomedia AI Agent Hub

Een lichte webapplicatie waarmee je je verschillende ChatGPT agents kunt organiseren. Selecteer een agent, lees de bijbehorende context en start meteen een chat in hetzelfde scherm.

## Functies

- 📚 **Agentbibliotheek** – Bewaar de naam, rol, beschrijving en systeem prompt van al je agents.
- 📝 **Bewerken en toevoegen** – Voeg nieuwe agents toe of bewerk bestaande via een duidelijke dialoog.
- 💬 **Chatpaneel per agent** – Praat direct met de geselecteerde agent. De volledige chatgeschiedenis blijft per agent bewaard in `localStorage`.
- 🔐 **Optionele OpenAI-koppeling** – Vul een API-key in om echte antwoorden via het OpenAI Chat Completions API-endpoint op te halen.
- 🧪 **Demo-modus** – Zonder API-key krijg je een voorbeeldantwoord zodat je de interface kunt testen.

## Installatie & gebruik

1. Download of clone deze repository.
2. Open `index.html` in je browser.
3. Voeg je eigen agents toe of werk de bestaande voorbeelden bij.
4. Ga naar het instellingenmenu (⚙️) om optioneel je OpenAI API-key in te voeren en echte chatantwoorden te ontvangen.

> Let op: je API-key wordt lokaal opgeslagen in je browser. Gebruik bij voorkeur een key met beperkte rechten.

## Aanpassen

De app gebruikt uitsluitend vanilla HTML, CSS en JavaScript. Wil je de styling of functionaliteit uitbreiden? Bewerk dan de volgende bestanden:

- `index.html` – markup en dialoogstructuur.
- `styles.css` – visuele stijl.
- `app.js` – logica voor agents, chat en instellingen.

Veel succes met het organiseren van je AI agents!
