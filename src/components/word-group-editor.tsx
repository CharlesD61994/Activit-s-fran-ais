"use client";

import { useMemo, useRef, useState } from "react";
import { Plus, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { GrammarWorkflowPlanner } from "@/components/grammar-workflow-planner";
import { readTextareaSelection } from "@/components/grammar/shared-textarea-selection";
import { defaultWorkflowForObjective, grammarObjectiveLabels } from "@/lib/grammar-workflow";
import { wordGroupAnswerLabels } from "@/lib/grammar-definitions";
import type {
  ClassGroup,
  SchoolLevel,
  Sentence,
  SentenceDifficulty,
  WordGroupTarget,
  WordGroupType
} from "@/types";
import type { GrammarObjective, GrammarWorkflowPhase } from "@/types";

type Props = {
  initialSentence?: Sentence;
  levels: SchoolLevel[];
  groups: ClassGroup[];
  onSave: (sentence: Sentence) => void;
};

type GroupDraft = {
  start: number;
  end: number;
  text: string;
  groupType: WordGroupType;
  nucleusStart?: number;
  nucleusEnd?: number;
  nucleusText?: string;
  analyzeNucleus?: boolean;
  mode?: "standard" | "contracted_nested";
  contractedGnText?: string;
  contractedPrepNucleus?: "de" | "à";
};

const groupLabels = wordGroupAnswerLabels;

const difficultyLabels: Record<SentenceDifficulty, string> = {
  easy: "Facile",
  medium: "Moyenne",
  hard: "Difficile"
};

function inferContractedGn(text: string) {
  const trimmed = text.trim();
  const match = trimmed.match(/^(du|des|au|aux)\b\s*(.*)$/i);
  if (!match) return null;

  const contraction = match[1].toLowerCase();
  const rest = match[2].trim();
  if (!rest) return null;

  const article =
    contraction === "du" || contraction === "au" ? "le" : "les";

  return `${article} ${rest}`;
}

function inferContractedPrepNucleus(text: string): "de" | "à" | null {
  const contraction = text.trim().split(/\s+/)[0]?.toLowerCase();
  if (contraction === "du" || contraction === "des") return "de";
  if (contraction === "au" || contraction === "aux") return "à";
  return null;
}

export function WordGroupEditor({ initialSentence, levels, groups, onSave }: Props) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [title, setTitle] = useState(initialSentence?.title ?? "");
  const [primaryObjective, setPrimaryObjective] = useState<GrammarObjective>(initialSentence?.primaryObjective ?? "word_groups");
  const [workflowPhases, setWorkflowPhases] = useState<GrammarWorkflowPhase[]>(initialSentence?.workflowPhases ?? defaultWorkflowForObjective(initialSentence?.primaryObjective ?? "word_groups"));
  const [levelId, setLevelId] = useState(initialSentence?.levelId ?? levels[0]?.id ?? "");
  const [difficulty, setDifficulty] = useState<SentenceDifficulty>(initialSentence?.difficulty ?? "medium");
  const [originalText, setOriginalText] = useState(initialSentence?.originalText ?? "");
  const [targets, setTargets] = useState<WordGroupTarget[]>(initialSentence?.wordGroupTargets ?? []);
  const [assignedGroupIds, setAssignedGroupIds] = useState<string[]>(initialSentence?.assignedGroupIds ?? []);
  const [draft, setDraft] = useState<GroupDraft | null>(null);
  const [message, setMessage] = useState("");

  const sortedTargets = useMemo(
    () => [...targets].sort((a,b) => a.start - b.start || b.end - a.end),
    [targets]
  );

  const draftNucleusCandidates = useMemo(() => {
    if (!draft) return [];

    return Array.from(
      draft.text.matchAll(/[\p{L}\p{N}À-ÖØ-öø-ÿŒœÆæ’'-]+/gu)
    ).map((match, index) => {
      const localStart = match.index ?? 0;
      const text = match[0];

      return {
        id: `${draft.start}-${localStart}-${index}`,
        text,
        start: draft.start + localStart,
        end: draft.start + localStart + text.length
      };
    });
  }, [draft]);

  function captureGroup() {
    const el = textareaRef.current;
    if (!el) return;
    const selection = readTextareaSelection(el, originalText);
    if (!selection) {
      setMessage("Sélectionne le groupe directement dans la phrase.");
      return;
    }
    const { start, end, text } = selection;
    const inferredContractedGn = inferContractedGn(text);
    setDraft({
      start,
      end,
      text,
      groupType: inferredContractedGn ? "GPrep" : "GN",
      mode: inferredContractedGn ? "contracted_nested" : "standard",
      contractedGnText: inferredContractedGn ?? undefined,
      contractedPrepNucleus:
        inferContractedPrepNucleus(text) ?? undefined,
      analyzeNucleus: true
    });
    setMessage("");
  }




  function setContractedMode(enabled: boolean) {
    if (!draft) return;

    if (!enabled) {
      setDraft({
        ...draft,
        mode: "standard",
        contractedGnText: undefined
      });
      return;
    }

    const inferred = inferContractedGn(draft.text);

    setDraft({
      ...draft,
      mode: "contracted_nested",
      groupType: "GPrep",
      contractedGnText: draft.contractedGnText ?? inferred ?? "",
      contractedPrepNucleus:
        draft.contractedPrepNucleus ??
        inferContractedPrepNucleus(draft.text) ??
        undefined,
      nucleusStart: draft.nucleusStart,
      nucleusEnd: draft.nucleusEnd,
      nucleusText: draft.nucleusText
    });
  }

  function chooseNucleus(start: number, end: number, text: string) {
    if (!draft) return;

    setDraft({
      ...draft,
      nucleusStart: start,
      nucleusEnd: end,
      nucleusText: text,
      analyzeNucleus: true
    });
    setMessage("");
  }

  function addGroup() {
    if (!draft) return;

    if (draft.mode === "contracted_nested") {
      const expected = draft.contractedGnText?.trim();
      if (!expected) {
        setMessage("Écris le GN attendu pour ce groupe contracté.");
        return;
      }

      if (!draft.contractedPrepNucleus) {
        setMessage("Choisis le noyau du GPrép.");
        return;
      }

      const nucleus = draftNucleusCandidates.find(
        (candidate) =>
          candidate.start === draft.nucleusStart &&
          candidate.end === draft.nucleusEnd
      );

      if (!nucleus) {
        setMessage("Choisis le noyau du GN avant d’ajouter le groupe.");
        return;
      }

      setTargets((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          start: draft.start,
          end: draft.end,
          text: draft.text,
          groupType: "GPrep",
          nucleusStart: nucleus.start,
          nucleusEnd: nucleus.end,
          nucleusText: nucleus.text,
          mode: "contracted_nested",
          contractedGnText: expected,
          contractedPrepNucleus:
            draft.contractedPrepNucleus ??
            inferContractedPrepNucleus(draft.text) ??
            undefined
        }
      ]);
      setDraft(null);
      setMessage("");
      return;
    }

    if (
      draft.analyzeNucleus !== false &&
      (
        !draft.nucleusText ||
        draft.nucleusStart === undefined ||
        draft.nucleusEnd === undefined
      )
    ) {
      setMessage("Choisis le noyau avant d’ajouter le groupe.");
      return;
    }

    const target: WordGroupTarget = {
        id: crypto.randomUUID(),
        start: draft.start,
        end: draft.end,
        text: draft.text,
        groupType: draft.groupType,
        nucleusStart: draft.analyzeNucleus === false ? undefined : draft.nucleusStart,
        nucleusEnd: draft.analyzeNucleus === false ? undefined : draft.nucleusEnd,
        nucleusText: draft.analyzeNucleus === false ? undefined : draft.nucleusText,
        analyzeNucleus: draft.analyzeNucleus !== false,
        mode: "standard"
      };
    setTargets((current) => [...current, target]);
    setWorkflowPhases((current) => current.map((phase) => phase.kind === "groups" ? {
      ...phase,
      actions: phase.actions.map((action) => action.kind === "find_nuclei" ? {
        ...action,
        enabled: target.analyzeNucleus !== false || targets.some((item) => item.analyzeNucleus !== false)
      } : action)
    } : phase));
    setDraft(null);
    setMessage("");
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!title.trim() || !levelId || !originalText.trim()) {
      setMessage("Le titre, le niveau et la phrase sont obligatoires.");
      return;
    }
    if (!targets.length) {
      setMessage("Configure au moins un groupe de mots.");
      return;
    }
    const invalid = targets.some(t =>
      originalText.slice(t.start,t.end) !== t.text ||
      (t.analyzeNucleus !== false && (
        t.nucleusStart === undefined ||
        t.nucleusEnd === undefined ||
        originalText.slice(t.nucleusStart,t.nucleusEnd) !== t.nucleusText
      )) ||
      (t.mode === "contracted_nested" && !t.contractedGnText?.trim())
    );
    if (invalid) {
      setMessage("La phrase a changé après la création des groupes. Recrée les groupes invalides.");
      return;
    }
    const now=new Date().toISOString();
    onSave({
      id: initialSentence?.id ?? crypto.randomUUID(),
      activityType:"word_groups",
      levelId, title:title.trim(), originalText, difficulty,
      primaryObjective, workflowPhases,
      grammarAnnotations: initialSentence?.grammarAnnotations ?? [],
      tags:initialSentence?.tags ?? [], corrections:[],
      wordGroupTargets:targets,
      assignedGroupIds,
      competitionEnabled:initialSentence?.competitionEnabled ?? false,
      assignmentStatusByGroup:initialSentence?.assignmentStatusByGroup ?? {},
      assignmentProgressByGroup:initialSentence?.assignmentProgressByGroup ?? {},
      createdAt:initialSentence?.createdAt ?? now, updatedAt:now
    });
  }

  const compatibleGroups=groups.filter(g=>g.levelId===levelId);

  return <form className="word-group-editor" onSubmit={submit}>
    <Card className="workflow-dock-card">
      <label className="workflow-objective">Objectif principal
        <select value={primaryObjective} onChange={event=>setPrimaryObjective(event.target.value as GrammarObjective)}>
          {(Object.entries(grammarObjectiveLabels) as Array<[GrammarObjective, string]>).map(([value,label])=><option key={value} value={value}>{label}</option>)}
        </select>
      </label>
      <GrammarWorkflowPlanner phases={workflowPhases} onChange={setWorkflowPhases}/>
    </Card>
    <Card className="editor-section-card">
      <span className="eyebrow">Étape 1</span><h2>Informations générales</h2>
      <div className="form-grid">
        <label>Titre<input value={title} onChange={e=>setTitle(e.target.value)} placeholder="Ex. Trouver les groupes nominaux" /></label>
        <label>Niveau<select value={levelId} onChange={e=>{setLevelId(e.target.value);setAssignedGroupIds([])}}>{levels.map(l=><option key={l.id} value={l.id}>{l.name}</option>)}</select></label>
        <label>Difficulté<select value={difficulty} onChange={e=>setDifficulty(e.target.value as SentenceDifficulty)}>{Object.entries(difficultyLabels).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>
      </div>
    </Card>

    <Card className="editor-section-card">
      <span className="eyebrow">Étape 2</span><h2>Phrase</h2>
      <p className="editor-help">Écris la phrase, puis surligne du premier au dernier mot du groupe.</p>
      <textarea ref={textareaRef} rows={7} value={originalText} onChange={e=>setOriginalText(e.target.value)} placeholder="Les grands chats noirs regardent les petits oiseaux." />
      <div className="selection-toolbar"><Button type="button" onClick={captureGroup}><Plus size={18}/> Ajouter le groupe sélectionné</Button></div>
    </Card>

    {draft && <Card className="correction-draft word-group-draft">
      <span className="eyebrow">Groupe sélectionné</span>
      <h2>[{draft.text}]</h2>
      <label className="word-group-contracted-toggle">
        <input
          type="checkbox"
          checked={draft.mode === "contracted_nested"}
          onChange={(event) => setContractedMode(event.target.checked)}
        />
        <span>Groupe enchâssé avec déterminant contracté</span>
      </label>

      {draft.mode === "contracted_nested" ? (
        <div className="word-group-contracted-editor">
          <div className="word-group-contract-summary">
            <div>
              <span>Groupe visible</span>
              <strong>GPrép : [{draft.text}]</strong>
            </div>
            <div>
              <span>Décomposition</span>
              <strong>
                {draft.text.trim().split(/\s+/)[0]} ={" "}
                {draft.contractedPrepNucleus ??
                  inferContractedPrepNucleus(draft.text) ??
                  "de"}{" "}
                +{" "}
                {draft.contractedGnText?.trim().split(/\s+/)[0] ?? "le"}
              </strong>
            </div>
          </div>

          <label>
            GN enchâssé à reconstruire
            <input
              value={draft.contractedGnText ?? ""}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  contractedGnText: event.target.value
                })
              }
              placeholder="Ex. le quartier"
            />
          </label>

          <div className="word-group-contract-part">
            <strong>Noyau du GPrép</strong>
            <p>
              Choisis la préposition contenue dans le déterminant
              contracté.
            </p>
            <div className="word-group-contract-choice-row">
              {(["de", "à"] as const).map((value) => (
                <button
                  type="button"
                  key={value}
                  className={`word-group-nucleus-option ${
                    draft.contractedPrepNucleus === value
                      ? "selected"
                      : ""
                  }`}
                  onClick={() =>
                    setDraft({
                      ...draft,
                      contractedPrepNucleus: value
                    })
                  }
                >
                  {value}
                </button>
              ))}
            </div>
          </div>

          <span className="word-group-contract-hint">
            Contractions prises en charge : du = de + le, des = de + les,
            au = à + le, aux = à + les.
          </span>
        </div>
      ) : (
        <label>
          Type de groupe
          <select
            value={draft.groupType}
            onChange={(event) =>
              setDraft({
                ...draft,
                groupType: event.target.value as WordGroupType
              })
            }
          >
            {Object.entries(groupLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      )}

      <div className="word-group-nucleus-step">
        <strong>
          {draft.mode === "contracted_nested"
            ? "Noyau du GN enchâssé"
            : "Noyau"}
        </strong>
        <p>
          {draft.mode === "contracted_nested"
            ? `Clique sur le noyau du GN « ${draft.contractedGnText || "à reconstruire"} ».`
            : "Clique directement sur le noyau du groupe."}
        </p>
        <div
          className="word-group-nucleus-options"
          role="group"
          aria-label="Choisir le noyau"
        >
          {draftNucleusCandidates.map((candidate) => {
            const selected =
              draft.nucleusStart === candidate.start &&
              draft.nucleusEnd === candidate.end;

            return (
              <button
                type="button"
                key={candidate.id}
                className={`word-group-nucleus-option ${
                  selected ? "selected" : ""
                }`}
                onClick={() =>
                  chooseNucleus(
                    candidate.start,
                    candidate.end,
                    candidate.text
                  )
                }
              >
                {candidate.text}
              </button>
            );
          })}
          {draft.mode !== "contracted_nested" && (
            <button
              type="button"
              className={`word-group-nucleus-option ${draft.analyzeNucleus === false ? "selected" : ""}`}
              onClick={() => setDraft({ ...draft, analyzeNucleus: false, nucleusStart: undefined, nucleusEnd: undefined, nucleusText: undefined })}
            >
              Pas d’analyse du noyau
            </button>
          )}
        </div>
        {draft.nucleusText && (
          <span className="word-group-nucleus-chip">
            Noyau : {draft.nucleusText}
          </span>
        )}
      </div>
      <div className="form-actions"><Button type="button" onClick={addGroup}>Ajouter le groupe</Button><Button type="button" variant="secondary" onClick={()=>setDraft(null)}>Annuler</Button></div>
    </Card>}

    <Card className="editor-section-card">
      <span className="eyebrow">Étape 3</span><h2>Groupes configurés</h2>
      <div className="word-group-configured-list">
        {sortedTargets.map(t=><div className="word-group-configured-row" key={t.id}>
          <span className="word-group-type-chip">
            {t.mode === "contracted_nested" ? "GPrép" : t.groupType}
          </span>
          <div>
            <strong>
              {t.mode === "contracted_nested" ? `[${t.text}]` : `[${t.text}]`}
            </strong>
            <span>
              {t.mode === "contracted_nested"
                ? `GN enchâssé : ${t.contractedGnText} · noyau : ${t.nucleusText} · noyau du GPrép : ${t.contractedPrepNucleus ?? "—"}`
                : t.analyzeNucleus === false ? "Pas d’analyse du noyau" : `Noyau : ${t.nucleusText}`}
            </span>
          </div>
          <button type="button" onClick={()=>setTargets(c=>c.filter(x=>x.id!==t.id))} aria-label={`Supprimer ${t.text}`}><Trash2 size={17}/></button>
        </div>)}
        {!targets.length && <p>Aucun groupe n’a encore été configuré.</p>}
      </div>
      <div className="word-group-preview">
        <span className="eyebrow">Aperçu</span>
        <p>{originalText || "La phrase apparaîtra ici."}</p>
        {sortedTargets.map(t=>
          <div key={t.id}>
            {t.mode === "contracted_nested" ? (
              <>
                <strong>GPrép</strong> [{t.text}] → GN enchâssé : <b>{t.contractedGnText}</b> · noyau : <b>{t.nucleusText}</b> · noyau du GPrép : <b>{t.contractedPrepNucleus ?? "—"}</b>
              </>
            ) : (
              <>
                <strong>{t.groupType}</strong> [{t.text}] · {t.analyzeNucleus === false ? "pas d’analyse du noyau" : <>noyau : <b>{t.nucleusText}</b></>}
              </>
            )}
          </div>
        )}
      </div>
    </Card>

    <Card className="editor-section-card">
      <span className="eyebrow">Attribution</span><h2>Groupes</h2>
      <div className="assignment-chips">{compatibleGroups.map(g=>{
        const assigned=assignedGroupIds.includes(g.id);
        return <button type="button" className={`assignment-chip ${assigned?"assigned":""}`} key={g.id} onClick={()=>setAssignedGroupIds(c=>assigned?c.filter(id=>id!==g.id):[...c,g.id])}>{g.name}</button>
      })}</div>
    </Card>
    {message && <p className="editor-error-message">{message}</p>}
    <div className="editor-save-row"><Button type="submit"><Save size={18}/> Enregistrer l’activité</Button></div>
  </form>;
}
