import "server-only";
import { assetDataUri } from "./storage";

// Two generation providers with the same queue pattern: submit a job, then poll its status.
// Higgsfield: https://docs.higgsfield.ai (Authorization: Key KEY_ID:KEY_SECRET)
// fal.ai:     https://fal.ai/docs/model-apis/model-endpoints/queue (Authorization: Key FAL_KEY)

export type ProviderId = "higgsfield" | "fal";

export type JobRef = { statusUrl: string; responseUrl: string };
export type JobState =
  | { state: "queued" | "running" }
  | { state: "done"; urls: string[] }
  | { state: "failed"; error: string };

export type Provider = {
  enabled(): boolean;
  /** Turn one of our stored assets into something the provider can fetch. */
  imageInput(assetId: string): Promise<string>;
  submit(endpoint: string, input: Record<string, unknown>): Promise<JobRef>;
  check(job: JobRef): Promise<JobState>;
};

function higgsfieldKey() {
  if (process.env.HF_KEY) return process.env.HF_KEY;
  if (process.env.HF_API_KEY && process.env.HF_API_SECRET) return `${process.env.HF_API_KEY}:${process.env.HF_API_SECRET}`;
  return "";
}

const hfBase = () => process.env.HF_BASE_URL || "https://api.higgsfield.ai";

async function hfFetch(pathOrUrl: string, init: RequestInit) {
  const url = pathOrUrl.startsWith("http") ? pathOrUrl : `${hfBase()}${pathOrUrl}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Key ${higgsfieldKey()}`,
      "Content-Type": "application/json",
      "User-Agent": "manomedia-studio/1.0",
    },
  });
  if (!res.ok) throw new Error(`Higgsfield gaf een fout (${res.status}): ${await safeText(res)}`);
  return res;
}

const higgsfield: Provider = {
  enabled: () => Boolean(higgsfieldKey()),

  async imageInput(assetId) {
    // Higgsfield wants a URL: get a pre-signed upload URL, PUT the bytes, pass on the public URL.
    const { asset, data } = await assetDataUri(assetId);
    const res = await hfFetch("/files/generate-upload-url", {
      method: "POST",
      body: JSON.stringify({ content_type: asset.mime }),
    });
    const { public_url, upload_url, upload_headers } = (await res.json()) as {
      public_url: string;
      upload_url: string;
      upload_headers?: Record<string, string>;
    };
    const put = await fetch(upload_url, {
      method: "PUT",
      headers: upload_headers ?? { "Content-Type": asset.mime },
      body: new Uint8Array(data),
    });
    if (!put.ok) throw new Error(`Upload naar Higgsfield mislukt (${put.status})`);
    return public_url;
  },

  async submit(endpoint, input) {
    const res = await hfFetch(`/${endpoint}`, { method: "POST", body: JSON.stringify(input) });
    const body = (await res.json()) as { request_id: string; status_url?: string };
    const statusUrl = body.status_url ?? `${hfBase()}/requests/${body.request_id}/status`;
    // Higgsfield returns the outputs on the status endpoint once completed.
    return { statusUrl, responseUrl: statusUrl };
  },

  async check(job) {
    const res = await hfFetch(job.statusUrl, { method: "GET" });
    const body = (await res.json()) as Record<string, unknown> & { status: string };
    switch (body.status) {
      case "queued":
        return { state: "queued" };
      case "in_progress":
        return { state: "running" };
      case "completed": {
        const urls = outputUrls(body);
        return urls.length ? { state: "done", urls } : { state: "failed", error: "Higgsfield gaf geen bestand terug" };
      }
      case "nsfw":
        return { state: "failed", error: "Geweigerd door de moderatie van Higgsfield (credits worden teruggestort)" };
      case "canceled":
        return { state: "failed", error: "Geannuleerd" };
      default:
        return { state: "failed", error: `Mislukt bij Higgsfield (${body.status})` };
    }
  },
};

const falHeaders = () => ({ Authorization: `Key ${process.env.FAL_KEY}`, "Content-Type": "application/json" });

const fal: Provider = {
  enabled: () => Boolean(process.env.FAL_KEY),

  async imageInput(assetId) {
    return (await assetDataUri(assetId)).uri; // fal accepts data: URIs
  },

  async submit(endpoint, input) {
    const base = process.env.FAL_QUEUE_URL || "https://queue.fal.run";
    const res = await fetch(`${base}/${endpoint}`, { method: "POST", headers: falHeaders(), body: JSON.stringify(input) });
    if (!res.ok) throw new Error(`fal.ai weigerde de opdracht (${res.status}): ${await safeText(res)}`);
    const body = (await res.json()) as { status_url: string; response_url: string };
    return { statusUrl: body.status_url, responseUrl: body.response_url };
  },

  async check(job) {
    const res = await fetch(job.statusUrl, { headers: falHeaders() });
    if (!res.ok) throw new Error(`fal.ai status mislukt (${res.status}): ${await safeText(res)}`);
    const { status } = (await res.json()) as { status: string };
    if (status === "IN_QUEUE") return { state: "queued" };
    if (status === "IN_PROGRESS") return { state: "running" };
    const result = await fetch(job.responseUrl, { headers: falHeaders() });
    if (!result.ok) return { state: "failed", error: `Model gaf een fout (${result.status}): ${await safeText(result)}` };
    const urls = outputUrls(await result.json());
    return urls.length ? { state: "done", urls } : { state: "failed", error: "Het model gaf geen bestand terug" };
  },
};

export const PROVIDERS: Record<ProviderId, Provider> = { higgsfield, fal };

export const anyProviderEnabled = () => Object.values(PROVIDERS).some((p) => p.enabled());

/** Output file URLs from a result: images[], image, or video. */
function outputUrls(result: Record<string, unknown>): string[] {
  const urls: string[] = [];
  const images = result.images as { url?: string }[] | undefined;
  if (Array.isArray(images)) for (const i of images) if (i?.url) urls.push(i.url);
  const image = result.image as { url?: string } | undefined;
  if (image?.url) urls.push(image.url);
  const video = result.video as { url?: string } | undefined;
  if (video?.url) urls.push(video.url);
  return urls;
}

async function safeText(res: Response) {
  try {
    return (await res.text()).slice(0, 300);
  } catch {
    return "";
  }
}
