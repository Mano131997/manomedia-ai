"use client";
import { useState } from "react";
import { api } from "./api";

export function Account({ name, email }: { name: string; email: string }) {
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formEl = e.currentTarget;
    const f = Object.fromEntries(new FormData(formEl)) as Record<string, string>;
    setMsg("");
    setError("");
    if (f.newPassword !== f.repeat) return setError("De twee nieuwe wachtwoorden zijn niet gelijk");
    try {
      await api("/api/me", { method: "PATCH", json: f });
      setMsg("Wachtwoord gewijzigd");
      formEl.reset();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <div className="page" style={{ maxWidth: 480 }}>
      <h1>{name}</h1>
      <p className="muted">{email}</p>
      <form onSubmit={submit} style={{ display: "grid", gap: 4 }}>
        <h2 style={{ fontSize: 16, marginTop: 24 }}>Wachtwoord wijzigen</h2>
        <label className="label" htmlFor="cur">Huidig wachtwoord</label>
        <input className="input" id="cur" name="currentPassword" type="password" autoComplete="current-password" required />
        <label className="label" htmlFor="new">Nieuw wachtwoord (min. 10 tekens)</label>
        <input className="input" id="new" name="newPassword" type="password" minLength={10} autoComplete="new-password" required />
        <label className="label" htmlFor="rep">Herhaal nieuw wachtwoord</label>
        <input className="input" id="rep" name="repeat" type="password" minLength={10} autoComplete="new-password" required />
        <button className="btn btn-primary" style={{ marginTop: 16 }}>Opslaan</button>
        {msg && <p style={{ color: "var(--success)" }}>{msg}</p>}
        {error && <p className="error" role="alert">{error}</p>}
      </form>
    </div>
  );
}
