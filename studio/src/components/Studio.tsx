"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, dollars, fileUrl, uploadFile } from "./api";
import { GenerationTiles, Lightbox } from "./Media";
import type { GenerationDTO } from "@/lib/generations";
import type { PublicModels } from "@/lib/models";

const ASPECTS = ["1:1", "16:9", "9:16", "4:3", "3:4"];

export function Studio({
  type,
  models,
  startAssetId,
}: {
  type: "image" | "video";
  models: PublicModels;
  startAssetId?: string;
}) {
  const list = type === "image" ? models.image : models.video;
  const [model, setModel] = useState(list[0].id);
  const [prompt, setPrompt] = useState("");
  const [aspect, setAspect] = useState(type === "image" ? "1:1" : "16:9");
  const [count, setCount] = useState(1);
  const [duration, setDuration] = useState<5 | 10>(5);
  const [refs, setRefs] = useState<string[]>(startAssetId ? [startAssetId] : []);
  const [items, setItems] = useState<GenerationDTO[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [drag, setDrag] = useState(false);
  const [open, setOpen] = useState<{ gen: GenerationDTO; assetId: string } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const imageModel = models.image.find((m) => m.id === model);
  const videoModel = models.video.find((m) => m.id === model);
  const maxRefs = type === "image" ? imageModel?.maxReferences ?? 0 : videoModel?.supportsStartImage ? 1 : 0;
  const cost = type === "image" ? (imageModel?.centsPerImage ?? 0) * count : (videoModel?.centsPerSecond ?? 0) * duration;

  const load = useCallback(async () => {
    try {
      setItems(await api<GenerationDTO[]>(`/api/generations?type=${type}&mine=1&take=60`));
    } catch (err) {
      setError((err as Error).message);
    }
  }, [type]);

  useEffect(() => {
    load();
  }, [load]);

  // Poll while something is still being made.
  const pending = items.some((g) => g.status === "queued" || g.status === "running");
  useEffect(() => {
    if (!pending) return;
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, [pending, load]);

  async function addFiles(files: FileList | File[]) {
    setError("");
    setUploading(true);
    try {
      for (const f of Array.from(files)) {
        if (!f.type.startsWith("image/")) throw new Error("Upload hier alleen afbeeldingen");
        const { id } = await uploadFile(f);
        setRefs((r) => [...r, id].slice(-Math.max(1, maxRefs)));
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setUploading(false);
    }
  }

  async function generate() {
    setBusy(true);
    setError("");
    try {
      const body =
        type === "image"
          ? { type, model, prompt, aspectRatio: aspect, count, referenceAssetIds: refs.slice(0, maxRefs) }
          : { type, model, prompt, aspectRatio: aspect, duration, startAssetId: maxRefs ? refs[0] : undefined };
      const gens = await api<GenerationDTO[]>("/api/generations", { method: "POST", json: body });
      setItems((prev) => [...gens, ...prev]);
      const failed = gens.find((g) => g.status === "failed");
      if (failed) setError(failed.error ?? "Mislukt");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const refLabel = type === "image" ? "Referentiebeelden" : "Startbeeld (optioneel)";

  return (
    <div className="studio">
      <section className="panel" aria-label="Instellingen">
        <h1>{type === "image" ? "Image" : "Video"}</h1>
        <p className="muted" style={{ margin: 0 }}>
          {type === "image" ? "Beschrijf het beeld dat je wil." : "Beschrijf de scène en de beweging."}
        </p>

        <label className="label" htmlFor="prompt">Prompt</label>
        <textarea
          id="prompt"
          className="textarea"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && prompt.trim()) generate();
          }}
          placeholder={
            type === "image"
              ? "Bv. productfoto van een glazen parfumfles op wit marmer, zacht ochtendlicht"
              : "Bv. langzame camerabeweging rond de fles, lichtreflecties bewegen over het glas"
          }
        />

        <span className="label">Model</span>
        <div className="model-list">
          {list.map((m) => (
            <button key={m.id} className="model" aria-pressed={m.id === model} onClick={() => setModel(m.id)}>
              <b>{m.label}</b>
              <small>{m.description}</small>
            </button>
          ))}
        </div>

        {maxRefs > 0 && (
          <>
            <span className="label">{refLabel}{type === "image" && ` (max ${maxRefs})`}</span>
            <div
              className={`dropzone${drag ? " drag" : ""}`}
              onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
              onDragLeave={() => setDrag(false)}
              onDrop={(e) => { e.preventDefault(); setDrag(false); addFiles(e.dataTransfer.files); }}
            >
              {uploading ? "Uploaden…" : "Sleep een afbeelding hierheen of "}
              {!uploading && (
                <button className="btn btn-sm" onClick={() => fileInput.current?.click()}>kies bestand</button>
              )}
              <input
                ref={fileInput}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                multiple={type === "image"}
                hidden
                onChange={(e) => e.target.files && addFiles(e.target.files)}
              />
            </div>
            {refs.length > 0 && (
              <div className="thumbs">
                {refs.slice(0, maxRefs).map((id) => (
                  <div className="thumb" key={id}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={fileUrl(id)} alt="Referentie" />
                    <button aria-label="Verwijderen" onClick={() => setRefs((r) => r.filter((x) => x !== id))}>×</button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {(type === "image" || (!(refs.length && maxRefs) && (videoModel?.aspectRatios.length ?? 0) > 0)) && (
          <>
            <span className="label">Formaat</span>
            <div className="seg">
              {(type === "image" ? ASPECTS : videoModel?.aspectRatios ?? []).map((a) => (
                <button key={a} aria-pressed={a === aspect} onClick={() => setAspect(a)}>{a}</button>
              ))}
            </div>
          </>
        )}

        {type === "image" ? (
          <>
            <span className="label">Aantal</span>
            <div className="seg">
              {[1, 2, 3, 4].map((n) => (
                <button key={n} aria-pressed={n === count} onClick={() => setCount(n)}>{n}</button>
              ))}
            </div>
          </>
        ) : (
          <>
            <span className="label">Duur</span>
            <div className="seg">
              {([5, 10] as const).map((d) => (
                <button key={d} aria-pressed={d === duration} onClick={() => setDuration(d)}>{d} sec</button>
              ))}
            </div>
          </>
        )}

        <div className="generate-bar">
          <button className="btn btn-primary" onClick={generate} disabled={busy || !prompt.trim() || uploading}>
            {busy ? "Versturen…" : "Genereer"}
          </button>
          <div className="cost">Geschatte kost ≈ {dollars(cost)} · Ctrl+Enter</div>
          {error && <p className="error" role="alert">{error}</p>}
        </div>
      </section>

      <section className="feed" aria-label="Resultaten">
        <div className="feed-head">
          <h2 style={{ margin: 0, fontSize: 16 }}>Mijn {type === "image" ? "beelden" : "video's"}</h2>
          <a className="btn btn-sm btn-ghost" href="/library">Hele galerij →</a>
        </div>
        {items.length === 0 ? (
          <div className="empty">Nog niets gemaakt. Schrijf links een prompt en klik op Genereer.</div>
        ) : (
          <div className="grid">
            {items.map((g) => (
              <GenerationTiles
                key={g.id}
                gen={g}
                onOpen={(assetId) => setOpen({ gen: g, assetId })}
                onReuse={() => {
                  setPrompt(g.prompt);
                  if (list.some((m) => m.id === g.model)) setModel(g.model);
                  if (g.settings.aspectRatio) setAspect(g.settings.aspectRatio);
                }}
                onReference={type === "image" ? (id) => setRefs((r) => [...r, id].slice(-Math.max(1, maxRefs))) : undefined}
              />
            ))}
          </div>
        )}
      </section>

      {open && <Lightbox gen={open.gen} assetId={open.assetId} onClose={() => setOpen(null)} />}
    </div>
  );
}
