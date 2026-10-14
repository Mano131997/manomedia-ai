"use client";
import { useCallback, useEffect, useState } from "react";
import { api, dollars } from "./api";

type U = { id: string; email: string; name: string; role: string; active: boolean; budgetCents: number; monthCents: number };
type Usage = { totalCents: number; byKind: { kind: string; cents: number; count: number }[]; byModel: { model: string; cents: number; count: number }[] };

export function Admin({ selfId }: { selfId: string }) {
  const [users, setUsers] = useState<U[]>([]);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    const [u, s] = await Promise.all([api<U[]>("/api/admin/users"), api<Usage>("/api/admin/usage")]);
    setUsers(u);
    setUsage(s);
  }, []);

  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, [load]);

  async function invite(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formEl = e.currentTarget;
    const f = Object.fromEntries(new FormData(formEl)) as Record<string, string>;
    setError("");
    setMsg("");
    try {
      await api("/api/admin/users", {
        method: "POST",
        json: { ...f, budgetCents: Math.round(Number(f.budget || 0) * 100) },
      });
      setMsg(`${f.name} heeft nu toegang. Geef het startwachtwoord veilig door; ze kunnen het wijzigen bij hun account.`);
      formEl.reset();
      load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function update(id: string, data: Record<string, unknown>) {
    setError("");
    try {
      await api(`/api/admin/users/${id}`, { method: "PATCH", json: data });
      load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  const kindLabel: Record<string, string> = { image: "Beelden", video: "Video's", chat: "Chat" };

  return (
    <div className="page">
      <h1>Team</h1>
      <p className="muted">Wie toegang heeft, en wat het deze maand kost. Bedragen zijn schattingen in dollar.</p>

      {usage && (
        <div className="stats">
          <div className="stat"><span className="muted">Totaal deze maand</span><b>{dollars(usage.totalCents)}</b></div>
          {usage.byKind.map((k) => (
            <div className="stat" key={k.kind}>
              <span className="muted">{kindLabel[k.kind] ?? k.kind} ({k.count})</span>
              <b>{dollars(k.cents)}</b>
            </div>
          ))}
        </div>
      )}

      <div className="section">
        <h2 style={{ fontSize: 16 }}>Collega toegang geven</h2>
        <form onSubmit={invite} className="form-row">
          <label>Naam<input className="input" name="name" required /></label>
          <label>E-mail<input className="input" name="email" type="email" required /></label>
          <label>Startwachtwoord<input className="input" name="password" minLength={10} required /></label>
          <label>Rol
            <select className="select" name="role" defaultValue="member">
              <option value="member">Lid</option>
              <option value="admin">Admin</option>
            </select>
          </label>
          <label>Budget/maand ($, 0 = geen)<input className="input" name="budget" type="number" min={0} step={1} defaultValue={0} /></label>
          <button className="btn btn-primary">Toegang geven</button>
        </form>
        {msg && <p style={{ color: "var(--success)" }}>{msg}</p>}
        {error && <p className="error" role="alert">{error}</p>}
      </div>

      <div className="section">
        <h2 style={{ fontSize: 16 }}>Gebruikers</h2>
        <table className="table">
          <thead>
            <tr><th>Naam</th><th>E-mail</th><th>Rol</th><th>Deze maand</th><th>Budget</th><th>Status</th><th /></tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} style={{ opacity: u.active ? 1 : 0.5 }}>
                <td>{u.name}</td>
                <td className="muted">{u.email}</td>
                <td>
                  <select className="select" value={u.role} disabled={u.id === selfId}
                    onChange={(e) => update(u.id, { role: e.target.value })}>
                    <option value="member">Lid</option>
                    <option value="admin">Admin</option>
                  </select>
                </td>
                <td>{dollars(u.monthCents)}</td>
                <td>
                  <button className="btn btn-sm" onClick={() => {
                    const v = prompt(`Maandbudget voor ${u.name} in dollar (0 = geen limiet)`, String(u.budgetCents / 100));
                    if (v !== null && !Number.isNaN(Number(v))) update(u.id, { budgetCents: Math.round(Number(v) * 100) });
                  }}>
                    {u.budgetCents ? dollars(u.budgetCents) : "Geen limiet"}
                  </button>
                </td>
                <td>{u.active ? "Actief" : "Geblokkeerd"}</td>
                <td style={{ whiteSpace: "nowrap" }}>
                  {u.id !== selfId && (
                    <button className={`btn btn-sm ${u.active ? "btn-danger" : ""}`}
                      onClick={() => update(u.id, { active: !u.active })}>
                      {u.active ? "Toegang intrekken" : "Opnieuw toegang"}
                    </button>
                  )}{" "}
                  <button className="btn btn-sm btn-ghost" onClick={() => {
                    const p = prompt(`Nieuw wachtwoord voor ${u.name} (min. 10 tekens)`);
                    if (p) update(u.id, { password: p });
                  }}>Wachtwoord resetten</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {usage && usage.byModel.length > 0 && (
        <div className="section">
          <h2 style={{ fontSize: 16 }}>Per model deze maand</h2>
          <table className="table">
            <thead><tr><th>Model</th><th>Aantal</th><th>Kost</th></tr></thead>
            <tbody>
              {usage.byModel.sort((a, b) => b.cents - a.cents).map((m) => (
                <tr key={m.model}><td>{m.model}</td><td>{m.count}</td><td>{dollars(m.cents)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
