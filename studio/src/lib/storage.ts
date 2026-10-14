import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { db } from "./db";

const ROOT = path.resolve(process.env.STORAGE_DIR || "./storage");

const EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/svg+xml": "svg",
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
};

export const ALLOWED_UPLOAD_MIME = ["image/png", "image/jpeg", "image/webp", "image/gif", "video/mp4"];
export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

export async function saveAsset(opts: {
  userId: string;
  kind: "upload" | "output";
  mime: string;
  data: Buffer;
  fileName?: string;
}) {
  const ext = EXT[opts.mime] ?? "bin";
  const key = `${new Date().toISOString().slice(0, 7)}/${crypto.randomUUID()}.${ext}`;
  const full = path.join(ROOT, key);
  await fs.mkdir(path.dirname(full), { recursive: true });
  await fs.writeFile(full, opts.data);
  return db.asset.create({
    data: {
      userId: opts.userId,
      kind: opts.kind,
      mime: opts.mime,
      fileName: opts.fileName || `manomedia-${Date.now()}.${ext}`,
      storageKey: key,
      size: opts.data.length,
    },
  });
}

export async function readAsset(storageKey: string) {
  const full = path.join(ROOT, storageKey);
  if (!full.startsWith(ROOT + path.sep)) throw new Error("invalid storage key");
  return fs.readFile(full);
}

export async function assetDataUri(assetId: string) {
  const asset = await db.asset.findUniqueOrThrow({ where: { id: assetId } });
  const data = await readAsset(asset.storageKey);
  return { asset, data, uri: `data:${asset.mime};base64,${data.toString("base64")}` };
}

/** Download a provider result URL into our own storage. */
export async function saveFromUrl(userId: string, url: string, fallbackMime: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download mislukt (${res.status})`);
  const mime = (res.headers.get("content-type") || fallbackMime).split(";")[0].trim();
  const data = Buffer.from(await res.arrayBuffer());
  return saveAsset({ userId, kind: "output", mime: EXT[mime] ? mime : fallbackMime, data });
}
