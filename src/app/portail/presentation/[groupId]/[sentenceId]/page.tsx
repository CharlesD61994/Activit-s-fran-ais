"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  Maximize,
  Minimize,
  RotateCcw
} from "lucide-react";
import { PresentationSentence } from "@/components/presentation/presentation-sentence";
import { Button } from "@/components/ui/button";
import { useAppStore } from "@/store/app-store";
import type { PresentationAnimation, PresentationMode } from "@/types";

export default function StudentPresentationPage({
  params
}: {
  params: Promise<{ groupId: string; sentenceId: string }>;
}) {
  const { groupId, sentenceId } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data } = useAppStore();

  const group = data.groups.find((item) => item.id === groupId);
  const sentence = data.sentences.find((item) => item.id === sentenceId);
  const planId = searchParams.get("plan");
  const plan = data.plannedSessions.find((item) => item.id === planId);

  const sequence = useMemo(() => {
    if (plan) {
      return plan.sentenceIds
        .map((id) => data.sentences.find((item) => item.id === id))
        .filter((item): item is NonNullable<typeof item> => Boolean(item));
    }

    return data.sentences.filter((item) =>
      item.assignedGroupIds.includes(groupId)
    );
  }, [data.sentences, groupId, plan]);

  const currentIndex = sequence.findIndex((item) => item.id === sentenceId);
  const previous = currentIndex > 0 ? sequence[currentIndex - 1] : null;
  const next = currentIndex >= 0 && currentIndex < sequence.length - 1
    ? sequence[currentIndex + 1]
    : null;

  const [revealedIds, setRevealedIds] = useState<string[]>([]);
  const [highlightUnrevealed, setHighlightUnrevealed] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const mode: PresentationMode = "classic";
  const animation: PresentationAnimation = "fade";

  const corrections = useMemo(
    () => [...(sentence?.corrections ?? [])].sort((a, b) => a.revealOrder - b.revealOrder),
    [sentence]
  );

  const nextCorrection = corrections.find((item) => !revealedIds.includes(item.id));

  useEffect(() => {
    if (!group) return;
    document.documentElement.dataset.theme = group.themeId;
    return () => {
      document.documentElement.dataset.theme = data.globalThemeId;
    };
  }, [data.globalThemeId, group]);

  useEffect(() => {
    const listener = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", listener);
    return () => document.removeEventListener("fullscreenchange", listener);
  }, []);

  if (!group || !sentence) {
    return (
      <div className="presentation-error">
        <h1>Activité introuvable</h1>
        <Link href="/portail">Retour au portail</Link>
      </div>
    );
  }

  function navigate(id: string) {
    const suffix = planId ? `?plan=${planId}` : "";
    router.push(`/portail/presentation/${groupId}/${id}${suffix}`);
  }

  async function toggleFullscreen() {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen();
    } else {
      await document.exitFullscreen();
    }
  }

  return (
    <div className="student-presentation-root">
      <header className="student-presentation-header">
        <Link href={`/portail/groupes/${groupId}`} className="presentation-back">
          <ArrowLeft size={19} />
          Retour
        </Link>

        <div>
          <strong>{group.name}</strong>
          <span>{sentence.title}</span>
        </div>

        <div className="presentation-top-actions">
          <button
            className="icon-control"
            onClick={() => setHighlightUnrevealed((value) => !value)}
            aria-label="Surligner les erreurs"
          >
            {highlightUnrevealed ? <EyeOff size={20} /> : <Eye size={20} />}
          </button>
          <button
            className="icon-control"
            onClick={toggleFullscreen}
            aria-label="Plein écran"
          >
            {isFullscreen ? <Minimize size={20} /> : <Maximize size={20} />}
          </button>
        </div>
      </header>

      <main
        className="presentation-stage"
        onClick={() => {
          if (!nextCorrection) return;
          setRevealedIds((items) => [...items, nextCorrection.id]);
        }}
      >
        <div className="presentation-scoreline">
          <span>{revealedIds.length}/{corrections.length} corrections</span>
        </div>

        <PresentationSentence
          sentence={sentence}
          correctionCodes={data.correctionCodes}
          revealedIds={revealedIds}
          currentCorrectionId={nextCorrection?.id}
          highlightUnrevealed={highlightUnrevealed}
          mode={mode}
          animation={animation}
        />
      </main>

      <footer className="student-presentation-controls">
        <Button
          variant="secondary"
          onClick={() => setRevealedIds((items) => items.slice(0, -1))}
          disabled={revealedIds.length === 0}
        >
          <ChevronLeft size={20} />
          Précédente
        </Button>

        <Button
          onClick={() => {
            if (!nextCorrection) return;
            setRevealedIds((items) => [...items, nextCorrection.id]);
          }}
          disabled={!nextCorrection}
        >
          Suivante
          <ChevronRight size={20} />
        </Button>

        <Button
          variant="secondary"
          onClick={() => setRevealedIds([])}
        >
          <RotateCcw size={18} />
          Recommencer
        </Button>

        {previous && (
          <Button variant="secondary" onClick={() => navigate(previous.id)}>
            Phrase précédente
          </Button>
        )}

        {next && (
          <Button variant="secondary" onClick={() => navigate(next.id)}>
            Phrase suivante
          </Button>
        )}
      </footer>
    </div>
  );
}
