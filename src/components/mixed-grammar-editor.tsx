"use client";

import { useMemo, useRef, useState } from "react";
import { Bold, Brackets, CheckCircle2, Frame, Highlighter, Play, Save, SpellCheck2, Trash2, Underline, X } from "lucide-react";
import { GrammarWorkflowPlanner } from "@/components/grammar-workflow-planner";
import { InteractiveSentenceReader } from "@/components/presentation/interactive-sentence-reader";
import { Button } from "@/components/ui/button";
import type { ClassGroup, CorrectionCode, GrammarAnnotation, GrammarAnnotationKind, GrammarPhaseKind, GrammarVisualEffect, GrammarWorkflowPhase, SchoolLevel, Sentence, SentenceCorrection, SentenceDifficulty } from "@/types";
import { createWorkflowPhase } from "@/lib/grammar-workflow";

type Props = { initialSentence?: Sentence; levels: SchoolLevel[]; groups: ClassGroup[]; correctionCodes: CorrectionCode[]; onSave: (sentence: Sentence) => void };
type Selection = { start: number; end: number };
type AnnotationDraft = { kind: Exclude<GrammarAnnotationKind, "error">; start: number; end: number; label: string; visualEffect: GrammarVisualEffect; responseMode: "click" | "frame" | "brackets"; parentAnnotationId?: string };
type CorrectionDraft = { start: number; end: number; originalText: string; correctedText: string; correctionCodeId: string; points: number };

const mechanics: Array<{ kind: Exclude<GrammarAnnotationKind, "error">; label: string; phase: GrammarPhaseKind; answers: string[]; visual: GrammarVisualEffect; response: "click" | "frame" | "brackets" }> = [
  { kind: "group", label: "Groupe", phase: "groups", answers: ["GN", "GV", "GAdj", "GAdv", "GPrép"], visual: { kind: "frame" }, response: "frame" },
  { kind: "nucleus", label: "Noyau", phase: "nuclei", answers: ["Nom", "Déterminant", "Verbe", "Adjectif", "Pronom", "Adverbe", "Préposition", "Conjonction"], visual: { kind: "color", color: "#d93434" }, response: "click" },
  { kind: "function", label: "Fonction", phase: "functions", answers: ["Sujet", "Prédicat", "Complément de phrase", "Complément direct", "Complément indirect", "Attribut du sujet", "Complément du nom"], visual: { kind: "brackets" }, response: "frame" },
  { kind: "word_class", label: "Classe de mot", phase: "word_classes", answers: ["Nom", "Déterminant", "Verbe", "Adjectif", "Pronom", "Adverbe", "Préposition", "Conjonction", "Interjection"], visual: { kind: "underline", color: "#2467d1" }, response: "click" },
  { kind: "donor", label: "Donneur", phase: "agreements", answers: ["Donneur d’accord"], visual: { kind: "highlight", color: "#fde68a" }, response: "click" },
  { kind: "receiver", label: "Receveur", phase: "agreements", answers: ["Receveur d’accord"], visual: { kind: "underline", color: "#22834b" }, response: "click" }
];
const mechanicLabel = Object.fromEntries(mechanics.map((item) => [item.kind, item.label]));
const visualNames: Record<GrammarVisualEffect["kind"], string> = { none: "Aucune", color: "Texte coloré", frame: "Encadrement", brackets: "Crochets", bold: "Gras", highlight: "Surlignage", underline: "Soulignement" };

function rebaseRange(previous: string, next: string, start: number, end: number) {
  let prefix = 0; while (prefix < previous.length && prefix < next.length && previous[prefix] === next[prefix]) prefix += 1;
  let suffix = 0; while (suffix < previous.length - prefix && suffix < next.length - prefix && previous[previous.length - 1 - suffix] === next[next.length - 1 - suffix]) suffix += 1;
  const oldChangedEnd = previous.length - suffix, newChangedEnd = next.length - suffix;
  const map = (position: number) => position <= prefix ? position : position >= oldChangedEnd ? newChangedEnd + (position - oldChangedEnd) : prefix;
  return { start: map(start), end: map(end) };
}

function renderMarkedText(text: string, annotations: GrammarAnnotation[]) {
  const boundaries = Array.from(new Set([0, text.length, ...annotations.flatMap((item) => [item.start, item.end])])).filter((value) => value >= 0 && value <= text.length).sort((a, b) => a - b);
  return boundaries.slice(0, -1).map((start, index) => {
    const end = boundaries[index + 1]; const active = annotations.filter((item) => item.start <= start && item.end >= end);
    const color = [...active].reverse().find((item) => item.visualEffect?.kind === "color")?.visualEffect?.color;
    const highlight = [...active].reverse().find((item) => item.visualEffect?.kind === "highlight")?.visualEffect?.color;
    const underline = [...active].reverse().find((item) => item.visualEffect?.kind === "underline")?.visualEffect?.color;
    const frames = active.filter((item) => item.visualEffect?.kind === "frame"), brackets = active.filter((item) => item.visualEffect?.kind === "brackets");
    const classes = [frames.length ? "mixed-mark-frame" : "", frames.some((item) => item.start === start) ? "frame-start" : "", frames.some((item) => item.end === end) ? "frame-end" : "", brackets.some((item) => item.start === start) ? "bracket-start" : "", brackets.some((item) => item.end === end) ? "bracket-end" : ""].filter(Boolean).join(" ");
    return <span key={`${start}-${end}`} className={classes} style={{ color, backgroundColor: highlight, fontWeight: active.some((item) => item.visualEffect?.kind === "bold") ? 800 : undefined, textDecoration: underline ? "underline" : undefined, textDecorationColor: underline }}>{text.slice(start, end)}</span>;
  });
}

export function MixedGrammarEditor({ initialSentence, levels, correctionCodes, onSave }: Props) {
  const now = new Date().toISOString();
  const [title, setTitle] = useState(initialSentence?.title ?? "");
  const [levelId, setLevelId] = useState(initialSentence?.levelId ?? levels[0]?.id ?? "");
  const [difficulty, setDifficulty] = useState<SentenceDifficulty>(initialSentence?.difficulty ?? "easy");
  const [tags, setTags] = useState(initialSentence?.tags.join(", ") ?? "");
  const [text, setText] = useState(initialSentence?.originalText ?? "Écris ta phrase ici.");
  const [annotations, setAnnotations] = useState<GrammarAnnotation[]>(initialSentence?.grammarAnnotations ?? []);
  const [corrections, setCorrections] = useState<SentenceCorrection[]>(initialSentence?.corrections ?? []);
  const [phases, setPhases] = useState<GrammarWorkflowPhase[]>(initialSentence?.workflowPhases ?? []);
  const [selection, setSelection] = useState<Selection>({ start: 0, end: 0 });
  const selectionRef = useRef(selection);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const liveTextRef = useRef(text);
  const [surfaceVersion, setSurfaceVersion] = useState(0);
  const [annotationDraft, setAnnotationDraft] = useState<AnnotationDraft | null>(null);
  const [correctionDraft, setCorrectionDraft] = useState<CorrectionDraft | null>(null);
  const [showTest, setShowTest] = useState(false);
  const [message, setMessage] = useState("");

  const sentence = useMemo<Sentence>(() => ({ id: initialSentence?.id ?? "mixed-preview", activityType: "sentence_correction", primaryObjective: "mixed_grammar", title: title.trim() || "Activité grammaticale mixte", levelId, difficulty, tags: tags.split(",").map((item) => item.trim()).filter(Boolean), originalText: text, corrections, grammarAnnotations: annotations, workflowPhases: phases, assignedGroupIds: initialSentence?.assignedGroupIds ?? [], showCorrectionCount: initialSentence?.showCorrectionCount ?? true, createdAt: initialSentence?.createdAt ?? now, updatedAt: now }), [annotations, corrections, difficulty, initialSentence, levelId, now, phases, tags, text, title]);

  function captureSelection() {
    const browserSelection = window.getSelection(); const element = surfaceRef.current;
    if (!browserSelection?.rangeCount || !element) return selectionRef.current;
    const range = browserSelection.getRangeAt(0); if (!element.contains(range.startContainer) || !element.contains(range.endContainer)) return selectionRef.current;
    const beforeStart = range.cloneRange(); beforeStart.selectNodeContents(element); beforeStart.setEnd(range.startContainer, range.startOffset);
    const beforeEnd = range.cloneRange(); beforeEnd.selectNodeContents(element); beforeEnd.setEnd(range.endContainer, range.endOffset);
    const liveText = liveTextRef.current;
    let start = beforeStart.toString().length, end = beforeEnd.toString().length; while (start < end && /\s/u.test(liveText[start])) start += 1; while (end > start && /\s/u.test(liveText[end - 1])) end -= 1;
    const next = { start, end }; selectionRef.current = next; setSelection(next); return next;
  }
  function commitLiveText() {
    const next = liveTextRef.current;
    if (next === text) return next;
    const previous = text;
    setAnnotations((current) => current.map((item) => ({ ...item, ...rebaseRange(previous, next, item.start, item.end) })).filter((item) => item.end > item.start));
    setCorrections((current) => current.map((item) => { const range = rebaseRange(previous, next, item.start, item.end); return { ...item, ...range, originalText: next.slice(range.start, range.end) }; }).filter((item) => item.end > item.start));
    setText(next);
    setSurfaceVersion((current) => current + 1);
    return next;
  }
  function requireSelection() { const range = captureSelection(); if (range.start === range.end) { setMessage("Sélectionne d’abord un mot ou un passage dans la phrase."); return null; } setMessage(""); return range; }
  function ensurePhase(kind: GrammarPhaseKind) { setPhases((current) => current.some((phase) => phase.kind === kind) ? current : [...current, createWorkflowPhase(kind)]); }
  function openMechanic(kind: Exclude<GrammarAnnotationKind, "error">) { const range = requireSelection(); const mechanic = mechanics.find((item) => item.kind === kind); if (!range || !mechanic) return; commitLiveText(); setCorrectionDraft(null); setAnnotationDraft({ kind, start: range.start, end: range.end, label: mechanic.answers[0], visualEffect: { ...mechanic.visual }, responseMode: mechanic.response }); }
  function openCorrection() { const range = requireSelection(); if (!range) return; const liveText = commitLiveText(); setAnnotationDraft(null); setCorrectionDraft({ start: range.start, end: range.end, originalText: liveText.slice(range.start, range.end), correctedText: "", correctionCodeId: correctionCodes.find((item) => item.isActive !== false)?.id ?? "", points: 1 }); }
  function saveAnnotation() { if (!annotationDraft) return; setAnnotations((current) => [...current, { id: crypto.randomUUID(), ...annotationDraft }]); ensurePhase(mechanics.find((item) => item.kind === annotationDraft.kind)!.phase); setAnnotationDraft(null); }
  function saveCorrection() { if (!correctionDraft?.correctedText.trim() || !correctionDraft.correctionCodeId) { setMessage("Entre la correction attendue et choisis son code."); return; } setCorrections((current) => [...current, { id: crypto.randomUUID(), ...correctionDraft, correctedText: correctionDraft.correctedText.trim(), revealOrder: current.length + 1 }]); ensurePhase("correction"); setCorrectionDraft(null); setMessage(""); }
  function submit(event: React.FormEvent) { event.preventDefault(); const liveText = liveTextRef.current; if (!title.trim() || !liveText.trim() || !levelId) { setMessage("Le titre, le niveau et la phrase sont obligatoires."); return; } const nextAnnotations = liveText === text ? annotations : annotations.map((item) => ({ ...item, ...rebaseRange(text, liveText, item.start, item.end) })).filter((item) => item.end > item.start); const nextCorrections = liveText === text ? corrections : corrections.map((item) => { const range = rebaseRange(text, liveText, item.start, item.end); return { ...item, ...range, originalText: liveText.slice(range.start, range.end) }; }).filter((item) => item.end > item.start); onSave({ ...sentence, id: initialSentence?.id ?? crypto.randomUUID(), title: title.trim(), originalText: liveText.trim(), grammarAnnotations: nextAnnotations, corrections: nextCorrections, updatedAt: new Date().toISOString() }); }
  const selectedText = annotationDraft ? text.slice(annotationDraft.start, annotationDraft.end) : correctionDraft?.originalText;
  const parentCandidates = annotationDraft ? annotations.filter((item) => item.start <= annotationDraft.start && item.end >= annotationDraft.end) : [];

  return <form className="mixed-studio" onSubmit={submit}>
    <header className="mixed-studio-meta">
      <label>Titre<input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Titre de l’activité"/></label>
      <label>Niveau<select value={levelId} onChange={(event) => setLevelId(event.target.value)}>{levels.map((level) => <option value={level.id} key={level.id}>{level.name}</option>)}</select></label>
      <label>Difficulté<select value={difficulty} onChange={(event) => setDifficulty(event.target.value as SentenceDifficulty)}><option value="easy">Facile</option><option value="medium">Moyenne</option><option value="hard">Difficile</option></select></label>
      <label>Étiquettes<input value={tags} onChange={(event) => setTags(event.target.value)} placeholder="accord, groupes…"/></label>
      <Button type="button" variant="secondary" onClick={() => { commitLiveText(); setShowTest((current) => !current); }}><Play size={17}/>{showTest ? "Fermer le test" : "Tester dans le lecteur"}</Button>
      <Button type="submit"><Save size={17}/>Enregistrer</Button>
    </header>

    <div className="mixed-studio-columns">
      <main className="mixed-studio-workbench">
        <div className="mixed-studio-toolbar" onMouseDown={(event) => { if ((event.target as HTMLElement).closest("button")) event.preventDefault(); }}>
          <div className="mixed-toolbar-group"><span>Réponses</span><button type="button" className="error" onClick={openCorrection}><SpellCheck2 size={16}/>Erreur</button>{mechanics.map((item) => <button type="button" key={item.kind} onClick={() => openMechanic(item.kind)}>{item.label}</button>)}</div>
          <div className="mixed-toolbar-group"><span>Apparence de la réponse</span><button type="button" title="Encadrer" onClick={() => annotationDraft && setAnnotationDraft({ ...annotationDraft, visualEffect: { kind: "frame" } })}><Frame size={17}/></button><button type="button" title="Crochets" onClick={() => annotationDraft && setAnnotationDraft({ ...annotationDraft, visualEffect: { kind: "brackets" } })}><Brackets size={17}/></button><button type="button" title="Gras" onClick={() => annotationDraft && setAnnotationDraft({ ...annotationDraft, visualEffect: { kind: "bold" } })}><Bold size={17}/></button><button type="button" title="Surligner" onClick={() => annotationDraft && setAnnotationDraft({ ...annotationDraft, visualEffect: { kind: "highlight", color: "#fde68a" } })}><Highlighter size={17}/></button><button type="button" title="Souligner" onClick={() => annotationDraft && setAnnotationDraft({ ...annotationDraft, visualEffect: { kind: "underline", color: "#2467d1" } })}><Underline size={17}/></button><button type="button" className="color-dot red" title="Rouge" onClick={() => annotationDraft && setAnnotationDraft({ ...annotationDraft, visualEffect: { kind: "color", color: "#d93434" } })}/><button type="button" className="color-dot blue" title="Bleu" onClick={() => annotationDraft && setAnnotationDraft({ ...annotationDraft, visualEffect: { kind: "color", color: "#2467d1" } })}/><button type="button" className="color-dot green" title="Vert" onClick={() => annotationDraft && setAnnotationDraft({ ...annotationDraft, visualEffect: { kind: "color", color: "#22834b" } })}/></div>
        </div>
        <section className="mixed-studio-canvas">
          <div className="mixed-canvas-heading"><div><span className="eyebrow">Phrase de travail</span><h2>Sélectionne directement les réponses</h2></div><span>{selection.end > selection.start ? `« ${text.slice(selection.start, selection.end)} »` : "Aucune sélection"}</span></div>
          <div key={surfaceVersion} ref={surfaceRef} className="mixed-studio-text" contentEditable suppressContentEditableWarning spellCheck onInput={(event) => { liveTextRef.current = event.currentTarget.innerText.replace(/\r/g, ""); }} onMouseUp={captureSelection} onKeyUp={captureSelection}>{renderMarkedText(text, annotations)}</div>
        </section>

        {(annotationDraft || correctionDraft) && <section className="mixed-selection-inspector">
          <div className="mixed-inspector-heading"><div><span className="eyebrow">Sélection</span><h3>« {selectedText} »</h3></div><button type="button" onClick={() => { setAnnotationDraft(null); setCorrectionDraft(null); }}><X size={17}/></button></div>
          {annotationDraft ? <div className="mixed-inspector-grid">
            <label>Mécanique<strong>{mechanicLabel[annotationDraft.kind]}</strong></label>
            <label>Réponse attendue<select value={annotationDraft.label} onChange={(event) => setAnnotationDraft({ ...annotationDraft, label: event.target.value })}>{mechanics.find((item) => item.kind === annotationDraft.kind)?.answers.map((answer) => <option key={answer}>{answer}</option>)}</select></label>
            <label>Marque qui apparaîtra<select value={annotationDraft.visualEffect.kind} onChange={(event) => setAnnotationDraft({ ...annotationDraft, visualEffect: { kind: event.target.value as GrammarVisualEffect["kind"], color: annotationDraft.visualEffect.color } })}>{Object.entries(visualNames).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
            {["color", "highlight", "underline"].includes(annotationDraft.visualEffect.kind) && <label>Couleur<input type="color" value={annotationDraft.visualEffect.color ?? "#d93434"} onChange={(event) => setAnnotationDraft({ ...annotationDraft, visualEffect: { ...annotationDraft.visualEffect, color: event.target.value } })}/></label>}
            <label>Geste demandé<select value={annotationDraft.responseMode} onChange={(event) => setAnnotationDraft({ ...annotationDraft, responseMode: event.target.value as AnnotationDraft["responseMode"] })}><option value="click">Cliquer sur le mot ou le passage</option><option value="frame">Tracer un encadrement</option><option value="brackets">Tracer les crochets</option></select></label>
            <label>Réponse parente<select value={annotationDraft.parentAnnotationId ?? ""} onChange={(event) => setAnnotationDraft({ ...annotationDraft, parentAnnotationId: event.target.value || undefined })}><option value="">Aucune — par lots</option>{parentCandidates.map((item) => <option value={item.id} key={item.id}>{mechanicLabel[item.kind]} : {text.slice(item.start, item.end)}</option>)}</select></label>
            <Button type="button" onClick={saveAnnotation}><CheckCircle2 size={17}/>Ajouter la réponse</Button>
          </div> : correctionDraft && <div className="mixed-inspector-grid"><label>Correction attendue<input value={correctionDraft.correctedText} onChange={(event) => setCorrectionDraft({ ...correctionDraft, correctedText: event.target.value })}/></label><label>Code<select value={correctionDraft.correctionCodeId} onChange={(event) => setCorrectionDraft({ ...correctionDraft, correctionCodeId: event.target.value })}>{correctionCodes.filter((item) => item.isActive !== false).map((code) => <option value={code.id} key={code.id}>{code.code} — {code.name}</option>)}</select></label><label>Points<input type="number" min="1" max="10" value={correctionDraft.points} onChange={(event) => setCorrectionDraft({ ...correctionDraft, points: Number(event.target.value) })}/></label><Button type="button" onClick={saveCorrection}><CheckCircle2 size={17}/>Ajouter l’erreur</Button></div>}
        </section>}

        <section className="mixed-answer-list"><div><span className="eyebrow">Réponses placées</span><h3>{corrections.length + annotations.length} éléments interactifs</h3></div>{corrections.map((item) => <div className="mixed-answer-row" key={item.id}><span className="answer-kind error">Erreur</span><strong>{item.originalText} → {item.correctedText}</strong><button type="button" onClick={() => setCorrections((current) => current.filter((candidate) => candidate.id !== item.id))}><Trash2 size={15}/></button></div>)}{annotations.map((item) => <div className={`mixed-answer-row ${item.parentAnnotationId ? "nested" : ""}`} key={item.id}><span className="answer-kind">{item.parentAnnotationId ? "↳ " : ""}{mechanicLabel[item.kind]}</span><strong>{text.slice(item.start, item.end)} — {item.label}</strong><small>{visualNames[item.visualEffect?.kind ?? "none"]}</small><button type="button" onClick={() => setAnnotations((current) => current.filter((candidate) => candidate.id !== item.id))}><Trash2 size={15}/></button></div>)}</section>
      </main>

      <aside className="mixed-studio-sidebar">
        <GrammarWorkflowPlanner phases={phases} onChange={setPhases}/>
        <div className="mixed-sidebar-help"><strong>Deux façons d’enchaîner</strong><p>Lie une action à sa parente pour traiter immédiatement le noyau du groupe choisi. Laisse-la indépendante pour terminer tous les groupes avant les noyaux.</p></div>
      </aside>
    </div>

    {showTest && <section className="mixed-test-reader"><div className="mixed-test-heading"><div><span className="eyebrow">Test sans enregistrer</span><h2>Lecteur de l’élève</h2></div><button type="button" onClick={() => setShowTest(false)}><X size={18}/></button></div><InteractiveSentenceReader sentence={sentence} correctionCodes={correctionCodes} onPoint={() => undefined} persistenceKey={`mixed-author-test-${initialSentence?.id ?? "new"}`} finishControl={<Button type="button" disabled>Terminé</Button>}/></section>}
    {message && <div className="form-message" role="alert">{message}</div>}
  </form>;
}
