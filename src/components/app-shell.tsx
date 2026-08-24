"use client";

import { useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { BarChart3, BookOpenCheck, CalendarDays, Home, MonitorPlay, Tags } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { SyncStatus } from "@/components/sync-status";
import { useAuth } from "@/features/auth/auth-provider";
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
  const router = useRouter();
  const { configured, loading: authLoading, user } = useAuth();
  const { hydrated } = useAppStore();
  const publicRoute =
    pathname === "/connexion" ||
    pathname.startsWith("/portail") ||
    pathname.startsWith("/presentation/");
  const requiresAuth = !publicRoute;

  useEffect(() => {
    if (!requiresAuth || authLoading) return;
    if (!configured || !user) router.replace("/connexion");
  }, [authLoading, configured, requiresAuth, router, user]);

  if (requiresAuth && authLoading) {
    return (
      <div className="app-loading-screen">
        <div className="app-loading-indicator" />
        <span>Vérification de la connexion…</span>
      </div>
    );
  }

  if (requiresAuth && (!configured || !user)) {
    return null;
  }

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
          <Image className="brand-mark" src="/alinea-icon.svg" alt="" width={42} height={42} aria-hidden="true" />
          <div>
            <strong>Alinéa</strong>
            <span>Activités de français</span>
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
