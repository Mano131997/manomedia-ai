import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { db } from "./db";
import { HttpError } from "./auth";
import { ASPECT_RATIOS, availableModels } from "./models";
import { createImageGeneration, waitForGeneration } from "./generations";
import { readAsset } from "./storage";
import { assertBudget, recordUsage } from "./usage";

const MODEL = "claude-opus-5-5";
// Claude Opus 5.5 list prices, US dollars per million tokens.
const PRICE = { input: 4, output: 20, cacheRead: 0.2, cacheWrite: 5 };
const MAX_TOOL_ROUNDS = 6;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const CLAUDE_IMAGE_MIME = ["image/png", "image/jpeg", "image/webp", "image/gif"] as const;

const client = new Anthropic();

const SYSTEM = `Je bent de ontwerpassistent van ManoMedia, een creatief bureau. Je helpt collega's in een gesprek om beelden te maken en bij te sturen: posters, social posts, advertenties, productfoto's, moodboards.

Zo werk je:
- Antwoord in de taal van de gebruiker (meestal Nederlands), kort en concreet.
- Wil iemand een beeld, roep dan generate_image aan. Schrijf de prompt voor het beeldmodel zelf, in het Engels, gedetailleerd: onderwerp, compositie, stijl, licht, kleuren, en letterlijk de tekst die in het beeld moet staan.
- Vraagt iemand een aanpassing op een eerder beeld of een geüploade foto, geef dan dat beeld mee via reference_asset_ids (de asset_id staat bij elk beeld in het gesprek) en beschrijf in de prompt alleen wat er moet veranderen en wat hetzelfde moet blijven.
- Is de vraag echt te vaag om iets goeds te maken, stel dan eerst één korte vraag. Anders: gewoon maken, en daarna aanbieden wat je kan bijsturen.
- Na een beeld: zeg in één of twee zinnen wat je gemaakt hebt. Herhaal de prompt niet.
- Kies het model dat past (zie de lijst hieronder). Voor bewerkingen met referentiebeelden: een model dat referenties neemt.`;

function systemPrompt() {
  const models = availableModels().image.map(
    (m) => `- ${m.id}: ${m.label}. ${m.description}${m.maxReferences ? ` Neemt tot ${m.maxReferences} referentiebeelden.` : " Geen referentiebeelden."}`,
  );
  return `${SYSTEM}\n\nBeschikbare beeldmodellen:\n${models.join("\n")}`;
}

const imageTool = (): Anthropic.Beta.BetaTool => ({
  name: "generate_image",
  description:
    "Maak een of meer afbeeldingen met een AI-beeldmodel. Met reference_asset_ids bewerk je een bestaand beeld of gebruik je het als voorbeeld. Geeft de asset_id's van de nieuwe beelden terug, en de beelden zelf.",
  strict: true,
  input_schema: {
    type: "object",
    additionalProperties: false,
    required: ["prompt", "aspect_ratio", "model", "count", "reference_asset_ids"],
    properties: {
      prompt: { type: "string", description: "Gedetailleerde Engelse prompt voor het beeldmodel." },
      aspect_ratio: { type: "string", enum: [...ASPECT_RATIOS] },
      model: { type: "string", enum: availableModels().image.map((m) => m.id) },
      count: { type: "integer", enum: [1, 2, 3, 4], description: "Aantal varianten, meestal 1." },
      reference_asset_ids: {
        type: "array",
        items: { type: "string" },
        description: "asset_id's van beelden om te bewerken of als voorbeeld te gebruiken. Leeg voor een nieuw beeld.",
      },
    },
  },
});

type GenerateImageInput = {
  prompt: string;
  aspect_ratio: string;
  model: string;
  count: number;
  reference_asset_ids: string[];
};

// Stored content uses this marker instead of base64, so the database stays small.
type AssetImageMarker = { type: "asset_image"; assetId: string };
type StoredBlock = Anthropic.Beta.BetaContentBlockParam | AssetImageMarker;

async function expandBlock(block: StoredBlock): Promise<Anthropic.Beta.BetaContentBlockParam[]> {
  if (block.type === "asset_image") return expandAsset(block.assetId);
  if (block.type === "tool_result" && Array.isArray(block.content)) {
    const content: NonNullable<Anthropic.Beta.BetaToolResultBlockParam["content"]> = [];
    for (const inner of block.content as (Exclude<Anthropic.Beta.BetaToolResultBlockParam["content"], string | undefined>[number] | AssetImageMarker)[]) {
      if (inner.type === "asset_image") {
        for (const b of await expandAsset(inner.assetId)) {
          if (b.type === "image" || b.type === "text") content.push(b);
        }
      } else content.push(inner);
    }
    return [{ ...block, content }];
  }
  return [block];
}

async function expandAsset(assetId: string): Promise<Anthropic.Beta.BetaContentBlockParam[]> {
  const asset = await db.asset.findUnique({ where: { id: assetId } });
  const label: Anthropic.Beta.BetaTextBlockParam = { type: "text", text: `[afbeelding asset_id=${assetId}]` };
  if (!asset) return [{ type: "text", text: `[afbeelding ${assetId} niet meer beschikbaar]` }];
  const mime = CLAUDE_IMAGE_MIME.find((m) => m === asset.mime);
  if (!mime || asset.size > MAX_IMAGE_BYTES) {
    return [label, { type: "text", text: "(dit beeld kan je niet zien: demo-afbeelding of te groot bestand)" }];
  }
  const data = (await readAsset(asset.storageKey)).toString("base64");
  return [label, { type: "image", source: { type: "base64", media_type: mime, data } }];
}

async function loadHistory(conversationId: string): Promise<Anthropic.Beta.BetaMessageParam[]> {
  const rows = await db.chatMessage.findMany({ where: { conversationId }, orderBy: { seq: "asc" } });
  const out: Anthropic.Beta.BetaMessageParam[] = [];
  for (const row of rows) {
    const stored = JSON.parse(row.apiContent) as StoredBlock[];
    const content: Anthropic.Beta.BetaContentBlockParam[] = [];
    for (const b of stored) content.push(...(await expandBlock(b)));
    out.push({ role: row.role as "user" | "assistant", content });
  }
  return out;
}

async function appendMessage(conversationId: string, role: "user" | "assistant", content: StoredBlock[]) {
  const last = await db.chatMessage.findFirst({ where: { conversationId }, orderBy: { seq: "desc" } });
  // The API needs alternating roles. A turn that was cut off (error, round limit)
  // can leave two in a row; merge them so the history stays valid.
  if (last && last.role === role) {
    const merged = [...(JSON.parse(last.apiContent) as StoredBlock[]), ...content];
    await db.chatMessage.update({ where: { id: last.id }, data: { apiContent: JSON.stringify(merged) } });
    return;
  }
  await db.chatMessage.create({
    data: { conversationId, role, seq: (last?.seq ?? 0) + 1, apiContent: JSON.stringify(content) },
  });
}

function usageCents(u: Anthropic.Beta.BetaUsage) {
  const dollars =
    (u.input_tokens * PRICE.input +
      u.output_tokens * PRICE.output +
      (u.cache_read_input_tokens ?? 0) * PRICE.cacheRead +
      (u.cache_creation_input_tokens ?? 0) * PRICE.cacheWrite) /
    1_000_000;
  return dollars * 100;
}

async function runImageTool(userId: string, input: GenerateImageInput): Promise<StoredBlock[]> {
  try {
    const gens = await createImageGeneration(
      userId,
      {
        model: input.model,
        prompt: input.prompt,
        aspectRatio: input.aspect_ratio,
        count: input.count,
        referenceAssetIds: input.reference_asset_ids,
      },
      "chat",
    );
    const results = await Promise.all(gens.map((g) => waitForGeneration(g.id)));
    const blocks: StoredBlock[] = [];
    for (const done of results) {
      if (done.status === "failed") blocks.push({ type: "text", text: `Mislukt: ${done.error ?? "onbekende fout"}` });
      else if (done.status !== "done") blocks.push({ type: "text", text: "Dit beeld is nog niet klaar; het verschijnt later in de galerij." });
      else for (const assetId of JSON.parse(done.outputAssetIds) as string[]) blocks.push({ type: "asset_image", assetId });
    }
    return blocks;
  } catch (err) {
    return [{ type: "text", text: `Mislukt: ${err instanceof Error ? err.message : String(err)}` }];
  }
}

/** Add a user message and let Claude answer, generating images as needed. */
export async function sendChatMessage(opts: {
  userId: string;
  conversationId: string;
  text: string;
  assetIds: string[];
}) {
  if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) {
    throw new HttpError(503, "De chat werkt pas met een ANTHROPIC_API_KEY in .env");
  }
  const text = opts.text.trim();
  if (!text && !opts.assetIds.length) throw new HttpError(400, "Leeg bericht");
  await assertBudget(opts.userId, 1);

  const userContent: StoredBlock[] = opts.assetIds.map((assetId) => ({ type: "asset_image", assetId }));
  if (text) userContent.push({ type: "text", text });
  await appendMessage(opts.conversationId, "user", userContent);

  const convo = await db.conversation.findUniqueOrThrow({ where: { id: opts.conversationId } });
  if (convo.title === "Nieuw gesprek" && text) {
    await db.conversation.update({ where: { id: convo.id }, data: { title: text.slice(0, 60) } });
  }

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const messages = await loadHistory(opts.conversationId);
    const response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "medium" },
      cache_control: { type: "ephemeral" },
      system: systemPrompt(),
      tools: [imageTool()],
      messages,
    });
    await recordUsage(opts.userId, "chat", response.model, usageCents(response.usage));
    await appendMessage(opts.conversationId, "assistant", response.content as Anthropic.Beta.BetaContentBlockParam[]);

    if (response.stop_reason === "refusal") break;
    if (response.stop_reason !== "tool_use") break;

    const results: StoredBlock[] = [];
    for (const block of response.content) {
      if (block.type !== "tool_use") continue;
      if (block.name !== "generate_image") {
        results.push({ type: "tool_result", tool_use_id: block.id, is_error: true, content: "Onbekende tool" });
        continue;
      }
      const content = await runImageTool(opts.userId, block.input as GenerateImageInput);
      results.push({
        type: "tool_result",
        tool_use_id: block.id,
        content: content as Anthropic.Beta.BetaToolResultBlockParam["content"],
      });
    }
    await appendMessage(opts.conversationId, "user", results);
  }
  await db.conversation.update({ where: { id: opts.conversationId }, data: { updatedAt: new Date() } });
}

export type ChatItem = { id: string; role: "user" | "assistant"; text: string; assetIds: string[]; notes: string[] };

/** Turn stored API messages into simple chat bubbles for the browser. */
export async function chatItems(conversationId: string): Promise<ChatItem[]> {
  const rows = await db.chatMessage.findMany({ where: { conversationId }, orderBy: { seq: "asc" } });
  const items: ChatItem[] = [];
  const assistant = (id: string) => {
    const last = items[items.length - 1];
    if (last?.role === "assistant") return last;
    const item: ChatItem = { id, role: "assistant", text: "", assetIds: [], notes: [] };
    items.push(item);
    return item;
  };
  for (const row of rows) {
    const blocks = JSON.parse(row.apiContent) as (StoredBlock & Record<string, unknown>)[];
    const isToolResults = row.role === "user" && blocks.every((b) => b.type === "tool_result");
    if (row.role === "user" && !isToolResults) {
      items.push({
        id: row.id,
        role: "user",
        text: blocks.filter((b) => b.type === "text").map((b) => b.text as string).join("\n"),
        assetIds: blocks.filter((b) => b.type === "asset_image").map((b) => b.assetId as string),
        notes: [],
      });
      continue;
    }
    const item = assistant(row.id);
    for (const b of blocks) {
      if (b.type === "text") item.text += (item.text ? "\n\n" : "") + (b.text as string);
      if (b.type === "tool_use") item.notes.push("Beeld gemaakt");
      if (b.type === "tool_result") {
        const content = (b.content ?? []) as (StoredBlock & Record<string, unknown>)[];
        if (Array.isArray(content)) {
          for (const c of content) {
            if (c.type === "asset_image") item.assetIds.push(c.assetId as string);
            if (c.type === "text" && String(c.text).startsWith("Mislukt")) item.notes.push(String(c.text));
          }
        }
      }
    }
  }
  return items;
}
