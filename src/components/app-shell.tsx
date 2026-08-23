"use client";

import Link from "next/link";
import { BarChart3, BookOpenCheck, CalendarDays, Home, MonitorPlay, Tags } from "lucide-react";
import { usePathname } from "next/navigation";
import { SyncStatus } from "@/components/sync-status";
import { useAppStore } from "@/store/app-store";

const items = [
  { href: "/", label: "Accueil", icon: Home },
  { href: "/phrases", label: "Activités", icon: BookOpenCheck },
  { href: "/seances", label: "Séances", icon: CalendarDays },
  { href: "/progression", label: "Progression", icon: BarChart3 },
  { href: "/parametres/codes", label: "Codes", icon: Tags },
  { href: "/classe", label: "Ouvrir Classe", icon: MonitorPlay }
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { hydrated } = useAppStore();

  if (!hydrated && pathname !== "/connexion") {
    return (
      <div className="app-loading-screen">
        <div className="app-loading-indicator" />
        <span>Chargement d’Alinéa - Activités de français…</span>
      </div>
    );
  }

  if (pathname.startsWith("/presentation/") || pathname.startsWith("/portail") || pathname.startsWith("/classe")) {
    return <>{children}</>;
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">P</div>
          <div>
            <strong>Activités de français</strong>
            <span>Tableau de bord</span>
          </div>
        </div>

        <nav aria-label="Navigation principale">
          {items.map(({ href, label, icon: Icon }) => {
            const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <Link className={`nav-link ${active ? "active" : ""}`} href={href} key={href}>
                <Icon size={20} aria-hidden="true" />
                <span>{label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <SyncStatus />
        </div>
      </aside>

      <div className="page-area">
        <header className="mobile-header">
          <strong>Activités de français</strong>
        </header>
        <main>{children}</main>
      </div>
    </div>
  );
}
