"use client";

export async function api<T = unknown>(url: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const { json, ...rest } = init ?? {};
  const res = await fetch(url, {
    ...rest,
    headers: json !== undefined ? { "Content-Type": "application/json", ...rest.headers } : rest.headers,
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });
  const body = await res.json().catch(() => ({}));
  if (res.status === 401 && !url.startsWith("/api/auth/")) window.location.href = "/login";
  if (!res.ok) throw new Error(body.error || `Fout ${res.status}`);
  return body as T;
}

export async function uploadFile(file: File): Promise<{ id: string; mime: string }> {
  const form = new FormData();
  form.append("file", file);
  return api("/api/uploads", { method: "POST", body: form });
}

export const fileUrl = (id: string) => `/api/files/${id}`;
export const downloadUrl = (id: string) => `/api/files/${id}?download=1`;
export const dollars = (cents: number) => `$${(cents / 100).toFixed(2)}`;
