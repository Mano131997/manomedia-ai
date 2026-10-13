"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, downloadUrl, fileUrl, uploadFile } from "./api";
import { Lightbox } from "./Media";
import type { ChatItem } from "@/lib/chat";

type ChatSummary = { id: string; title: string };
type ChatDetail = { id: string; title: string; items: ChatItem[] };

const EXAMPLES = [
  "Maak een Instagram-post voor de opening van een koffiebar in Antwerpen, met de tekst 'Grand Opening 12/11'",
  "Ontwerp een minimalistische poster voor een jazzavond, donkerblauw en goud",
  "Maak een productfoto van sneakers op een betonnen achtergrond, studiolicht",
];

export function Chat({ initialId }: { initialId?: string }) {
  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [current, setCurrent] = useState<ChatDetail | null>(null);
  const [text, setText] = useState("");
  const [attachments, setAttachments] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const [pendingText, setPendingText] = useState("");
  const [error, setError] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const bottom = useRef<HTMLDivElement>(null);

  const loadList = useCallback(async () => setChats(await api<ChatSummary[]>("/api/chats")), []);

  const openChat = useCallback(async (id: string) => {
    setError("");
    setCurrent(await api<ChatDetail>(`/api/chats/${id}`));
    window.history.replaceState(null, "", `/chat?id=${id}`);
  }, []);

  useEffect(() => {
    loadList();
    if (initialId) openChat(initialId).catch(() => setCurrent(null));
  }, [initialId, loadList, openChat]);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth" });
  }, [current, sending]);

  function newChat() {
    setCurrent(null);
    setText("");
    setAttachments([]);
    window.history.replaceState(null, "", "/chat");
  }

  async function send(message = text) {
    if ((!message.trim() && !attachments.length) || sending) return;
    setSending(true);
    setError("");
    setPendingText(message);
    setText("");
    const files = attachments;
    setAttachments([]);
    try {
      let id = current?.id;
      if (!id) {
        id = (await api<ChatSummary>("/api/chats", { method: "POST" })).id;
        window.history.replaceState(null, "", `/chat?id=${id}`);
      }
      const detail = await api<ChatDetail>(`/api/chats/${id}/messages`, {
        method: "POST",
        json: { text: message, assetIds: files },
      });
      setCurrent(detail);
      loadList();
    } catch (err) {
      setError((err as Error).message);
      setText(message);
      setAttachments(files);
      if (current?.id) openChat(current.id).catch(() => {});
    } finally {
      setSending(false);
      setPendingText("");
    }
  }

  async function attach(files: FileList) {
    setError("");
    try {
      for (const f of Array.from(files).slice(0, 4)) {
        if (!f.type.startsWith("image/")) throw new Error("Alleen afbeeldingen in de chat");
        const { id } = await uploadFile(f);
        setAttachments((a) => [...a, id].slice(-4));
      }
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function remove(id: string) {
    if (!confirm("Dit gesprek verwijderen? De beelden blijven in de galerij.")) return;
    await api(`/api/chats/${id}`, { method: "DELETE" });
    if (current?.id === id) newChat();
    loadList();
  }

  return (
    <div className="chat">
      <aside className="chat-list" aria-label="Gesprekken">
        <button className="btn btn-primary" onClick={newChat} style={{ marginBottom: 10 }}>+ Nieuw gesprek</button>
        {chats.map((c) => (
          <div key={c.id} style={{ display: "flex", alignItems: "center" }}>
            <a
              href={`/chat?id=${c.id}`}
              className={current?.id === c.id ? "active" : ""}
              style={{ flex: 1 }}
              onClick={(e) => { e.preventDefault(); openChat(c.id); }}
            >
              {c.title}
            </a>
            <button className="btn btn-ghost btn-sm" aria-label="Verwijder gesprek" onClick={() => remove(c.id)}>×</button>
          </div>
        ))}
      </aside>

      <section className="chat-main">
        <div className="messages">
          {!current && !sending && (
            <div className="msg" style={{ marginTop: "10vh" }}>
              <h1 style={{ margin: 0 }}>Wat gaan we maken?</h1>
              <p className="muted">Beschrijf wat je nodig hebt, of upload een foto om aan te passen. Je kan daarna gewoon bijsturen: "maak de achtergrond blauw", "meer ruimte voor tekst"…</p>
              <div style={{ display: "grid", gap: 8 }}>
                {EXAMPLES.map((ex) => (
                  <button key={ex} className="btn" style={{ textAlign: "left" }} onClick={() => send(ex)}>{ex}</button>
                ))}
              </div>
            </div>
          )}
          {current?.items.map((item) => (
            <div key={item.id} className={`msg ${item.role}`}>
              {item.role === "user" && item.assetIds.length > 0 && <Images ids={item.assetIds} onOpen={setOpen} />}
              {item.text && <div className="bubble">{item.text}</div>}
              {item.role === "assistant" && item.assetIds.length > 0 && <Images ids={item.assetIds} onOpen={setOpen} />}
              {item.notes.filter((n) => n.startsWith("Mislukt")).map((n, i) => (
                <div key={i} className="note" style={{ color: "var(--danger)" }}>{n}</div>
              ))}
            </div>
          ))}
          {sending && (
            <>
              {pendingText && <div className="msg user"><div className="bubble">{pendingText}</div></div>}
              <div className="msg"><div className="pending" style={{ justifyItems: "start", padding: 0 }}>
                <div className="spinner" aria-hidden />
                <span>Bezig… een beeld maken duurt soms een halve minuut.</span>
              </div></div>
            </>
          )}
          <div ref={bottom} />
        </div>

        <div className="composer">
          <div className="composer-inner">
            {attachments.length > 0 && (
              <div className="thumbs" style={{ marginTop: 0 }}>
                {attachments.map((id) => (
                  <div className="thumb" key={id}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={fileUrl(id)} alt="Bijlage" />
                    <button aria-label="Verwijderen" onClick={() => setAttachments((a) => a.filter((x) => x !== id))}>×</button>
                  </div>
                ))}
              </div>
            )}
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
              }}
              placeholder="Beschrijf wat je wil maken… (Enter = versturen, Shift+Enter = nieuwe regel)"
              aria-label="Bericht"
            />
            <div className="composer-row">
              <button className="btn btn-sm" onClick={() => fileInput.current?.click()}>📎 Afbeelding</button>
              <input ref={fileInput} type="file" accept="image/png,image/jpeg,image/webp" multiple hidden
                onChange={(e) => e.target.files && attach(e.target.files)} />
              <button className="btn btn-primary btn-sm" onClick={() => send()} disabled={sending || (!text.trim() && !attachments.length)}>
                Versturen
              </button>
            </div>
            {error && <p className="error" role="alert" style={{ margin: 0 }}>{error}</p>}
          </div>
        </div>
      </section>
      {open && <Lightbox gen={null} assetId={open} onClose={() => setOpen(null)} />}
    </div>
  );
}

function Images({ ids, onOpen }: { ids: string[]; onOpen: (id: string) => void }) {
  return (
    <div className="msg-images">
      {ids.map((id) => (
        <div className="msg-image" key={id}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={fileUrl(id)} alt="" onClick={() => onOpen(id)} />
          <div className="card-actions">
            <a className="btn btn-sm" href={downloadUrl(id)}>Download</a>
            <a className="btn btn-sm btn-ghost" href={`/video?start=${id}`}>Maak video</a>
          </div>
        </div>
      ))}
    </div>
  );
}
