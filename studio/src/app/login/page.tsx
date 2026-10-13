"use client";
import { useState } from "react";
import { api } from "@/components/api";

export default function LoginPage() {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true);
    setError("");
    try {
      await api("/api/auth/login", { method: "POST", json: Object.fromEntries(form) });
      window.location.href = "/image";
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <main className="login">
      <form onSubmit={submit}>
        <div className="brand" style={{ padding: "0 0 12px" }}>ManoMedia <span>Studio</span></div>
        <label className="label" htmlFor="email">E-mail</label>
        <input className="input" id="email" name="email" type="email" autoComplete="email" required />
        <label className="label" htmlFor="password">Wachtwoord</label>
        <input className="input" id="password" name="password" type="password" autoComplete="current-password" required />
        <button className="btn btn-primary" style={{ marginTop: 20, padding: 12 }} disabled={busy}>
          {busy ? "Bezig…" : "Inloggen"}
        </button>
        {error && <p className="error" role="alert">{error}</p>}
        <p className="muted" style={{ fontSize: 12, marginTop: 16 }}>Geen account? Vraag toegang aan een admin.</p>
      </form>
    </main>
  );
}
