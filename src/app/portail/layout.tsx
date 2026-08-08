"use client";

import Link from "next/link";
import { GraduationCap, Home } from "lucide-react";

export default function StudentPortalLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="student-portal-shell">
      <header className="student-portal-header">
        <Link href="/portail" className="student-portal-brand">
          <span className="student-portal-logo"><GraduationCap size={24} /></span>
          <div>
            <strong>Phrase du jour</strong>
            <span>Portail élève</span>
          </div>
        </Link>

        <Link href="/portail" className="student-home-link">
          <Home size={18} />
          Accueil
        </Link>
      </header>

      <main className="student-portal-main">
        {children}
      </main>
    </div>
  );
}
