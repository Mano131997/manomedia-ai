"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { api } from "./api";

const LINKS = [
  { href: "/image", label: "Image", icon: "▣" },
  { href: "/video", label: "Video", icon: "▶" },
  { href: "/chat", label: "Chat", icon: "✦" },
  { href: "/library", label: "Galerij", icon: "▦" },
];

export function Sidebar({ name, isAdmin, demo }: { name: string; isAdmin: boolean; demo: boolean }) {
  const path = usePathname();
  const links = isAdmin ? [...LINKS, { href: "/admin", label: "Team", icon: "⚙" }] : LINKS;
  return (
    <nav className="sidebar" aria-label="Hoofdmenu">
      <div className="brand">ManoMedia <span>Studio</span></div>
      {links.map((l) => (
        <Link key={l.href} href={l.href} className={`nav-link${path.startsWith(l.href) ? " active" : ""}`}>
          <span aria-hidden>{l.icon}</span>
          {l.label}
        </Link>
      ))}
      <div className="sidebar-foot">
        {demo && <span className="badge" title="Geen FAL_KEY ingesteld">Demo-modus</span>}
        <Link href="/account" className="muted">{name}</Link>
        <button
          className="btn btn-sm"
          onClick={async () => {
            await api("/api/auth/logout", { method: "POST" });
            window.location.href = "/login";
          }}
        >
          Uitloggen
        </button>
      </div>
    </nav>
  );
}
