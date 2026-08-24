"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LogIn, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/features/auth/auth-provider";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export default function LoginPage() {
  const router = useRouter();
  const { loading, user } = useAuth();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user) router.replace("/");
  }, [loading, router, user]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setMessage("");

    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      setMessage("Supabase n’est pas encore configuré. L’application reste utilisable en mode local.");
      return;
    }

    setSubmitting(true);

    if (mode === "signup") {
      const { error } = await supabase.auth.signUp({ email, password });
      setSubmitting(false);
      if (error) {
        setMessage(error.message);
        return;
      }
      setMessage("Compte créé. Vérifie ton courriel si la confirmation est activée.");
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setSubmitting(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    router.push("/");
    router.refresh();
  }

  return (
    <div className="auth-page">
      <Card className="auth-card">
        <div>
          <span className="eyebrow">Alinéa - Activités de français</span>
          <h1>{mode === "login" ? "Connexion" : "Créer un compte"}</h1>
          <p>
            Synchronise tes groupes, tes phrases et tes points entre tes appareils.
          </p>
        </div>

        {!isSupabaseConfigured && (
          <div className="form-message">
            Supabase n’est pas configuré. Ajoute les variables d’environnement pour activer la connexion.
          </div>
        )}

        <form onSubmit={submit}>
          <label>Adresse courriel
            <input
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>

          <label>Mot de passe
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>

          {message && <div className="form-message">{message}</div>}

          <Button type="submit" disabled={submitting || !isSupabaseConfigured}>
            {mode === "login" ? <LogIn size={18} /> : <UserPlus size={18} />}
            {mode === "login" ? "Se connecter" : "Créer le compte"}
          </Button>
        </form>

        <button
          className="auth-switch"
          onClick={() => setMode((current) => current === "login" ? "signup" : "login")}
        >
          {mode === "login"
            ? "Je n’ai pas encore de compte"
            : "J’ai déjà un compte"}
        </button>
      </Card>
    </div>
  );
}
