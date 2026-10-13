"use client";
import { useCallback, useEffect, useState } from "react";
import { api } from "./api";
import { GenerationTiles, Lightbox } from "./Media";
import type { GenerationDTO } from "@/lib/generations";

export function Library() {
  const [type, setType] = useState<"" | "image" | "video">("");
  const [mine, setMine] = useState(false);
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<GenerationDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<{ gen: GenerationDTO; assetId: string } | null>(null);

  const load = useCallback(async () => {
    const params = new URLSearchParams({ take: "200" });
    if (type) params.set("type", type);
    if (mine) params.set("mine", "1");
    setItems(await api<GenerationDTO[]>(`/api/generations?${params}`));
    setLoading(false);
  }, [type, mine]);

  useEffect(() => {
    load();
  }, [load]);

  const q = query.trim().toLowerCase();
  const shown = items.filter(
    (g) => g.status !== "failed" && (!q || g.prompt.toLowerCase().includes(q) || g.userName?.toLowerCase().includes(q)),
  );

  return (
    <div className="feed">
      <div className="feed-head">
        <h1 style={{ margin: 0, fontSize: 20 }}>Galerij</h1>
        <div className="seg">
          {([["", "Alles"], ["image", "Beelden"], ["video", "Video's"]] as const).map(([v, l]) => (
            <button key={v} aria-pressed={type === v} onClick={() => setType(v)}>{l}</button>
          ))}
          <button aria-pressed={mine} onClick={() => setMine((m) => !m)}>Alleen mijn werk</button>
        </div>
        <input
          className="input"
          style={{ maxWidth: 260 }}
          placeholder="Zoek op prompt of naam"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Zoeken"
        />
      </div>
      {loading ? (
        <div className="pending"><div className="spinner" /></div>
      ) : shown.length === 0 ? (
        <div className="empty">Nog niets in de galerij.</div>
      ) : (
        <div className="grid">
          {shown.map((g) => (
            <GenerationTiles key={g.id} gen={g} onOpen={(assetId) => setOpen({ gen: g, assetId })} />
          ))}
        </div>
      )}
      {open && <Lightbox gen={open.gen} assetId={open.assetId} onClose={() => setOpen(null)} />}
    </div>
  );
}
