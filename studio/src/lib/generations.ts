import "server-only";
import { db } from "./db";
import { HttpError } from "./auth";
import { ASPECT_RATIOS, getModel, type AspectRatio, type Model } from "./models";
import { PROVIDERS, anyProviderEnabled } from "./providers";
import { saveAsset, saveFromUrl } from "./storage";
import { assertBudget, recordUsage } from "./usage";
import type { Generation } from "@prisma/client";

export type ImageRequest = {
  model: string;
  prompt: string;
  aspectRatio?: string;
  count?: number;
  referenceAssetIds?: string[];
};

export type VideoRequest = {
  model: string;
  prompt: string;
  aspectRatio?: string;
  duration?: number;
  startAssetId?: string;
};

function aspect(v?: string): AspectRatio {
  return (ASPECT_RATIOS as readonly string[]).includes(v ?? "") ? (v as AspectRatio) : "1:1";
}

function cleanPrompt(p: unknown) {
  const s = typeof p === "string" ? p.trim() : "";
  if (!s) throw new HttpError(400, "Schrijf eerst een prompt");
  if (s.length > 4000) throw new HttpError(400, "Prompt is te lang (max 4000 tekens)");
  return s;
}

function providerFor(model: Model) {
  if (!anyProviderEnabled()) return null; // demo mode
  const provider = PROVIDERS[model.provider];
  if (!provider.enabled()) throw new HttpError(400, `${model.label} is niet beschikbaar (geen sleutel voor ${model.provider})`);
  return provider;
}

/** Returns one generation per provider request (models without batches get one request per image). */
export async function createImageGeneration(
  userId: string,
  req: ImageRequest,
  source: "studio" | "chat" = "studio",
): Promise<Generation[]> {
  const model = getModel(req.model);
  if (!model || model.type !== "image") throw new HttpError(400, "Onbekend beeldmodel");
  const prompt = cleanPrompt(req.prompt);
  const count = Math.min(4, Math.max(1, Math.floor(req.count ?? 1)));
  const refs = req.referenceAssetIds ?? [];
  if (refs.length > model.maxReferences) {
    throw new HttpError(400, `${model.label} neemt maximaal ${model.maxReferences} referentiebeeld(en)`);
  }
  const provider = providerFor(model);
  await assertBudget(userId, model.centsPerImage * count);

  const aspectRatio = aspect(req.aspectRatio);
  const perRequest = model.batch ? count : 1;
  const requests = model.batch ? 1 : count;
  const gens = await Promise.all(
    Array.from({ length: requests }, () =>
      db.generation.create({
        data: {
          userId, type: "image", source, model: model.id, prompt,
          settings: JSON.stringify({ aspectRatio, count: perRequest }),
          inputAssetIds: JSON.stringify(refs),
          costCents: model.centsPerImage * perRequest,
        },
      }),
    ),
  );

  if (!provider) return Promise.all(gens.map((g) => finishDemoImage(g, perRequest)));

  let referenceUrls: string[];
  try {
    referenceUrls = await Promise.all(refs.map((id) => provider.imageInput(id)));
  } catch (err) {
    return Promise.all(gens.map((g) => fail(g.id, err)));
  }
  const params = { prompt, aspectRatio, count: perRequest, referenceUrls };
  return Promise.all(
    gens.map(async (gen) => {
      try {
        const job = await provider.submit(model.endpoint(params), model.input(params));
        await recordUsage(userId, "image", model.id, gen.costCents);
        return db.generation.update({
          where: { id: gen.id },
          data: { providerStatusUrl: job.statusUrl, providerResponseUrl: job.responseUrl },
        });
      } catch (err) {
        return fail(gen.id, err);
      }
    }),
  );
}

export async function createVideoGeneration(userId: string, req: VideoRequest) {
  const model = getModel(req.model);
  if (!model || model.type !== "video") throw new HttpError(400, "Onbekend videomodel");
  const prompt = cleanPrompt(req.prompt);
  const duration: 5 | 10 = req.duration === 10 ? 10 : 5;
  if (req.startAssetId && !model.supportsStartImage) throw new HttpError(400, `${model.label} kan geen startbeeld gebruiken`);
  if (!req.startAssetId && model.requiresStartImage) throw new HttpError(400, `${model.label} heeft een startbeeld nodig`);
  const provider = providerFor(model);
  const cost = model.centsPerSecond * duration;
  await assertBudget(userId, cost);

  const aspectRatio = model.aspectRatios.includes(aspect(req.aspectRatio)) ? aspect(req.aspectRatio) : (model.aspectRatios[0] ?? "16:9");
  const gen = await db.generation.create({
    data: {
      userId, type: "video", source: "studio", model: model.id, prompt,
      settings: JSON.stringify({ aspectRatio, duration }),
      inputAssetIds: JSON.stringify(req.startAssetId ? [req.startAssetId] : []),
      costCents: cost,
    },
  });

  if (!provider) {
    return fail(gen.id, new Error("Demo-modus: video genereren werkt pas met een HF_KEY (Higgsfield) in .env"));
  }

  try {
    const startImageUrl = req.startAssetId ? await provider.imageInput(req.startAssetId) : undefined;
    const params = { prompt, aspectRatio, duration, startImageUrl };
    const job = await provider.submit(model.endpoint(params), model.input(params));
    await recordUsage(userId, "video", model.id, cost);
    return db.generation.update({
      where: { id: gen.id },
      data: { providerStatusUrl: job.statusUrl, providerResponseUrl: job.responseUrl },
    });
  } catch (err) {
    return fail(gen.id, err);
  }
}

/** Ask the provider how a pending job is doing; store the outputs once it is done. */
export async function refreshGeneration(gen: Generation): Promise<Generation> {
  if (gen.status !== "queued" && gen.status !== "running") return gen;
  if (!gen.providerStatusUrl || !gen.providerResponseUrl) return gen;
  const model = getModel(gen.model);
  if (!model) return fail(gen.id, new Error("Model bestaat niet meer"));
  try {
    const result = await PROVIDERS[model.provider].check({
      statusUrl: gen.providerStatusUrl,
      responseUrl: gen.providerResponseUrl,
    });
    if (result.state === "failed") return fail(gen.id, new Error(result.error));
    if (result.state !== "done") {
      if (result.state === gen.status) return gen;
      return db.generation.update({ where: { id: gen.id }, data: { status: result.state } });
    }
    // Claim the job so two pollers don't both download the outputs.
    const claimed = await db.generation.updateMany({
      where: { id: gen.id, status: { in: ["queued", "running"] } },
      data: { status: "saving" },
    });
    if (claimed.count === 0) return db.generation.findUniqueOrThrow({ where: { id: gen.id } });

    const fallbackMime = gen.type === "video" ? "video/mp4" : "image/png";
    const assets = [];
    for (const url of result.urls) assets.push(await saveFromUrl(gen.userId, url, fallbackMime));
    return db.generation.update({
      where: { id: gen.id },
      data: { status: "done", outputAssetIds: JSON.stringify(assets.map((a) => a.id)) },
    });
  } catch (err) {
    return fail(gen.id, err);
  }
}

export async function waitForGeneration(id: string, timeoutMs = 120_000): Promise<Generation> {
  const deadline = Date.now() + timeoutMs;
  let gen = await db.generation.findUniqueOrThrow({ where: { id } });
  while (Date.now() < deadline) {
    gen = await refreshGeneration(gen);
    if (gen.status === "done" || gen.status === "failed") return gen;
    await new Promise((r) => setTimeout(r, 2000));
    gen = await db.generation.findUniqueOrThrow({ where: { id } });
  }
  return gen;
}

async function fail(id: string, err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  return db.generation.update({ where: { id }, data: { status: "failed", error: message.slice(0, 500) } });
}

// Demo mode (no FAL_KEY): a placeholder image with the prompt, so the whole app can be tried for free.
async function finishDemoImage(gen: Generation, count: number) {
  const { aspectRatio } = JSON.parse(gen.settings) as { aspectRatio: AspectRatio };
  const [w, h] = aspectRatio.split(":").map(Number);
  const W = 1024;
  const H = Math.round((W * h) / w);
  const ids: string[] = [];
  for (let i = 0; i < count; i++) {
    const hue = (hash(gen.prompt) + i * 47) % 360;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${hue},70%,45%)"/><stop offset="1" stop-color="hsl(${(hue + 80) % 360},70%,25%)"/></linearGradient></defs>
<rect width="100%" height="100%" fill="url(#g)"/>
<text x="50%" y="46%" text-anchor="middle" font-family="sans-serif" font-size="40" fill="#fff" opacity=".9">DEMO</text>
<text x="50%" y="56%" text-anchor="middle" font-family="sans-serif" font-size="24" fill="#fff" opacity=".8">${escapeXml(gen.prompt.slice(0, 60))}</text>
</svg>`;
    const asset = await saveAsset({ userId: gen.userId, kind: "output", mime: "image/svg+xml", data: Buffer.from(svg) });
    ids.push(asset.id);
  }
  return db.generation.update({
    where: { id: gen.id },
    data: { status: "done", costCents: 0, outputAssetIds: JSON.stringify(ids) },
  });
}

function hash(s: string) {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h;
}

function escapeXml(s: string) {
  return s.replace(/[<>&"']/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" })[c]!);
}

/** Shape sent to the browser. */
export function serializeGeneration(g: Generation & { user?: { name: string } }) {
  return {
    id: g.id,
    type: g.type,
    source: g.source,
    model: g.model,
    prompt: g.prompt,
    settings: JSON.parse(g.settings),
    inputAssetIds: JSON.parse(g.inputAssetIds) as string[],
    outputAssetIds: JSON.parse(g.outputAssetIds) as string[],
    status: g.status === "saving" ? "running" : g.status,
    error: g.error,
    costCents: g.costCents,
    createdAt: g.createdAt.toISOString(),
    userName: g.user?.name,
  };
}
export type GenerationDTO = ReturnType<typeof serializeGeneration>;
