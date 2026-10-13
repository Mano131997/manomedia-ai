"use client";
import { useEffect } from "react";
import { downloadUrl, fileUrl } from "./api";
import type { GenerationDTO } from "@/lib/generations";

export function MediaView({ id, type, controls }: { id: string; type: string; controls?: boolean }) {
  if (type === "video") {
    return <video src={fileUrl(id)} controls={controls} muted={!controls} loop playsInline preload="metadata" />;
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={fileUrl(id)} alt="" loading="lazy" />;
}

export function Lightbox({
  gen,
  assetId,
  onClose,
}: {
  gen: Pick<GenerationDTO, "type" | "prompt" | "model" | "userName" | "createdAt"> | null;
  assetId: string;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  const type = gen?.type ?? "image";
  return (
    <div className="modal" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="modal-inner" onClick={(e) => e.stopPropagation()}>
        <MediaView id={assetId} type={type} controls />
        <div className="modal-meta">
          {gen && <div>{gen.prompt}</div>}
          <div className="card-actions" style={{ alignItems: "center" }}>
            <a className="btn btn-primary btn-sm" href={downloadUrl(assetId)}>Download</a>
            {type === "image" && <a className="btn btn-sm" href={`/video?start=${assetId}`}>Maak video</a>}
            <button className="btn btn-sm" onClick={onClose}>Sluiten</button>
            {gen && (
              <span className="muted" style={{ fontSize: 12, marginLeft: "auto" }}>
                {gen.model} · {gen.userName} · {new Date(gen.createdAt).toLocaleString("nl-BE")}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/** One tile per output file; a pending or failed job shows one status tile. */
export function GenerationTiles({
  gen,
  onOpen,
  onReuse,
  onReference,
}: {
  gen: GenerationDTO;
  onOpen: (assetId: string) => void;
  onReuse?: () => void;
  onReference?: (assetId: string) => void;
}) {
  if (gen.status !== "done") {
    return (
      <div className="card">
        <div className="card-media" style={{ cursor: "default" }}>
          {gen.status === "failed" ? (
            <div className="pending" style={{ color: "var(--danger)" }}>Mislukt<br /><span className="muted">{gen.error}</span></div>
          ) : (
            <div className="pending">
              <div className="spinner" aria-hidden />
              {gen.status === "queued" ? "In de wachtrij…" : gen.type === "video" ? "Video wordt gemaakt… (enkele minuten)" : "Bezig…"}
            </div>
          )}
        </div>
        <div className="card-body"><div className="card-prompt">{gen.prompt}</div></div>
      </div>
    );
  }
  return (
    <>
      {gen.outputAssetIds.map((assetId) => (
        <div className="card" key={assetId}>
          <button className="card-media" style={{ border: 0, padding: 0 }} onClick={() => onOpen(assetId)} aria-label="Groot bekijken">
            <MediaView id={assetId} type={gen.type} />
          </button>
          <div className="card-body">
            <div className="card-prompt" title={gen.prompt}>{gen.prompt}</div>
            <div className="card-actions">
              <a className="btn btn-sm" href={downloadUrl(assetId)}>Download</a>
              {onReuse && <button className="btn btn-sm btn-ghost" onClick={onReuse}>Hergebruik</button>}
              {onReference && gen.type === "image" && (
                <button className="btn btn-sm btn-ghost" onClick={() => onReference(assetId)}>Als referentie</button>
              )}
              {gen.type === "image" && <a className="btn btn-sm btn-ghost" href={`/video?start=${assetId}`}>Maak video</a>}
            </div>
          </div>
        </div>
      ))}
    </>
  );
}
