import type { AppData, CorrectionCode, Sentence } from "@/types";

export const correctionCodes: CorrectionCode[] = [
  { id: "code-o", code: "O", name: "Orthographe d’usage", category: "orthography", color: "#2563eb", isActive: true },
  { id: "code-a", code: "A", name: "Accord", category: "agreement", color: "#7c3aed", isActive: true },
  { id: "code-c", code: "C", name: "Conjugaison", category: "conjugation", color: "#dc2626", isActive: true },
  { id: "code-h", code: "H", name: "Homophone", category: "homophone", color: "#ea580c", isActive: true },
  { id: "code-p", code: "P", name: "Ponctuation", category: "punctuation", color: "#0891b2", isActive: true },
  { id: "code-s", code: "S", name: "Syntaxe", category: "syntax", color: "#475569", isActive: true },
  { id: "code-v", code: "V", name: "Vocabulaire", category: "vocabulary", color: "#059669", isActive: true },
  { id: "code-pps", code: "PPS", name: "Participe passé employé seul", category: "participle", color: "#9333ea", isActive: true },
  { id: "code-ppa", code: "PPA", name: "Participe passé employé avec avoir", category: "participle", color: "#c026d3", isActive: true },
  { id: "code-ppe", code: "PPE", name: "Participe passé employé avec être", category: "participle", color: "#a21caf", isActive: true }
];

const now = "2026-08-04T12:00:00.000Z";

const demoSentences: Sentence[] = [
  {
    id: "phrase-1",
    levelId: "sec-2",
    title: "Participes passés et accords",
    originalText: "Les élèves se sont demander pourquoi leurs enseignantes étaient absente.",
    difficulty: "medium",
    tags: ["PPA", "accord"],
    corrections: [
      {
        id: "corr-1",
        start: 19,
        end: 27,
        originalText: "demander",
        correctedText: "demandé",
        correctionCodeId: "code-ppa",
        points: 2,
        revealOrder: 1
      },
      {
        id: "corr-2",
        start: 62,
        end: 69,
        originalText: "absente",
        correctedText: "absentes",
        correctionCodeId: "code-a",
        points: 1,
        revealOrder: 2
      }
    ],
    assignedGroupIds: ["groupe-201"],
    showCorrectionCount: true,
    createdAt: now,
    updatedAt: now
  },
  {
    id: "phrase-2",
    levelId: "sec-1",
    title: "Homophones",
    originalText: "Ces amis son arrivés tôt et on apporté leurs livres.",
    difficulty: "easy",
    tags: ["homophones"],
    corrections: [
      {
        id: "corr-3",
        start: 10,
        end: 13,
        originalText: "son",
        correctedText: "sont",
        correctionCodeId: "code-h",
        points: 1,
        revealOrder: 1
      },
      {
        id: "corr-4",
        start: 29,
        end: 31,
        originalText: "on",
        correctedText: "ont",
        correctionCodeId: "code-h",
        points: 1,
        revealOrder: 2
      }
    ],
    assignedGroupIds: ["groupe-101", "groupe-102"],
    showCorrectionCount: true,
    createdAt: now,
    updatedAt: now
  },
  {
    id: "phrase-3",
    levelId: "sec-4",
    title: "Conjugaison et syntaxe",
    originalText: "Si j'aurais su, je serais venu plus rapidement.",
    difficulty: "hard",
    tags: ["conditionnel", "syntaxe"],
    corrections: [
      {
        id: "corr-5",
        start: 3,
        end: 12,
        originalText: "j'aurais",
        correctedText: "j’avais",
        correctionCodeId: "code-c",
        points: 2,
        revealOrder: 1
      }
    ],
    assignedGroupIds: ["groupe-401"],
    showCorrectionCount: false,
    createdAt: now,
    updatedAt: now
  },
  {
    id: "phrase-4",
    levelId: "sec-1",
    title: "Accords dans le groupe du nom",
    originalText: "Les grande maisons blanche bordent la rivière.",
    difficulty: "easy",
    tags: ["accord", "groupe du nom"],
    corrections: [
      {
        id: "corr-6",
        start: 4,
        end: 10,
        originalText: "grande",
        correctedText: "grandes",
        correctionCodeId: "code-a",
        points: 1,
        revealOrder: 1
      },
      {
        id: "corr-7",
        start: 19,
        end: 26,
        originalText: "blanche",
        correctedText: "blanches",
        correctionCodeId: "code-a",
        points: 1,
        revealOrder: 2
      }
    ],
    assignedGroupIds: ["groupe-101"],
    showCorrectionCount: true,
    createdAt: now,
    updatedAt: now
  },
  {
    id: "phrase-5",
    levelId: "sec-2",
    title: "Orthographe d’usage",
    originalText: "Le dévelopement de cette idée semble interressant.",
    difficulty: "medium",
    tags: ["orthographe"],
    corrections: [
      {
        id: "corr-8",
        start: 3,
        end: 14,
        originalText: "dévelopement",
        correctedText: "développement",
        correctionCodeId: "code-o",
        points: 1,
        revealOrder: 1
      },
      {
        id: "corr-9",
        start: 35,
        end: 46,
        originalText: "interressant",
        correctedText: "intéressant",
        correctionCodeId: "code-o",
        points: 1,
        revealOrder: 2
      }
    ],
    assignedGroupIds: ["groupe-201"],
    showCorrectionCount: true,
    createdAt: now,
    updatedAt: now
  },
  {
    id: "phrase-6",
    levelId: "sec-4",
    title: "Ponctuation",
    originalText: "Cependant il refusa de répondre à la question.",
    difficulty: "medium",
    tags: ["ponctuation"],
    corrections: [
      {
        id: "corr-10",
        start: 0,
        end: 9,
        originalText: "Cependant",
        correctedText: "Cependant,",
        correctionCodeId: "code-p",
        points: 1,
        revealOrder: 1
      }
    ],
    assignedGroupIds: ["groupe-401"],
    showCorrectionCount: false,
    createdAt: now,
    updatedAt: now
  }
];

export const demoData: AppData = {
  dataVersion: 21,
  schoolYears: [
    { id: "year-2026-2027", name: "Année scolaire 2026-2027", order: 1 }
  ],
  levels: [
    { id: "sec-1", name: "Secondaire 1", order: 1 },
    { id: "sec-2", name: "Secondaire 2", order: 2 },
    { id: "sec-4", name: "Secondaire 4", order: 4 }
  ],
  groups: [
    { id: "groupe-101", levelId: "sec-1", schoolYearId: "year-2026-2027", name: "Groupe 101", description: "Premier cycle", accentColor: "#2878df", totalPoints: 145, sentenceCount: 12, studentPortalEnabled: true, studentAccessCode: "1010" },
    { id: "groupe-102", levelId: "sec-1", schoolYearId: "year-2026-2027", name: "Groupe 102", description: "Premier cycle", accentColor: "#0f9f91", totalPoints: 132, sentenceCount: 10, studentPortalEnabled: true },
    { id: "groupe-201", levelId: "sec-2", schoolYearId: "year-2026-2027", name: "Groupe 201", description: "Consolidation", accentColor: "#7757cf", totalPoints: 98, sentenceCount: 8, studentPortalEnabled: true, studentAccessCode: "2010" },
    { id: "groupe-401", levelId: "sec-4", schoolYearId: "year-2026-2027", name: "Groupe 401", description: "Deuxième cycle", accentColor: "#e6921b", totalPoints: 176, sentenceCount: 15, studentPortalEnabled: true }
  ],
  teams: [
    { id: "team-101-a", groupId: "groupe-101", name: "Équipe A", icon: "🦊", points: 48, members: ["Alex", "Maya", "Émile"] },
    { id: "team-101-b", groupId: "groupe-101", name: "Équipe B", icon: "🤖", points: 52, members: ["Léa", "Thomas"] },
    { id: "team-101-c", groupId: "groupe-101", name: "Équipe C", icon: "🐙", points: 45, members: [] },
    { id: "team-201-a", groupId: "groupe-201", name: "Les Lynx", icon: "🐆", points: 49, members: [] },
    { id: "team-201-b", groupId: "groupe-201", name: "Les Hiboux", icon: "🦉", points: 49, members: [] }
  ],
  correctionCodes,
  sentences: demoSentences,
  collections: [
    {
      id: "collection-sec1-homophones",
      levelId: "sec-1",
      name: "Homophones et accords",
      description: "Courte collection de révision pour le premier cycle.",
      sentenceIds: ["phrase-2", "phrase-4"],
      assignedGroupIds: ["groupe-101"],
      scheduledDate: "2026-08-10",
      createdAt: now,
      updatedAt: now
    },
    {
      id: "collection-sec2-revision",
      levelId: "sec-2",
      name: "Révision de secondaire 2",
      description: "Participes passés et orthographe d’usage.",
      sentenceIds: ["phrase-1", "phrase-5"],
      assignedGroupIds: ["groupe-201"],
      scheduledDate: "2026-08-12",
      createdAt: now,
      updatedAt: now
    }
  ],
  plannedSessions: [
    {
      id: "session-plan-101",
      groupId: "groupe-101",
      title: "Révision du lundi",
      scheduledDate: "2026-08-10",
      sentenceIds: ["phrase-2", "phrase-4"],
      status: "planned",
      currentSentenceIndex: 0,
      createdAt: now,
      updatedAt: now
    }
  ],
  reviewStates: [
    {
      id: "review-201-phrase-1",
      groupId: "groupe-201",
      sentenceId: "phrase-1",
      markedForReview: true,
      difficultyScore: 3,
      nextReviewAt: "2026-08-12"
    }
  ],
  scoreEvents: [],
  competitionResults: [],
  dashboardTitle: "Année scolaire 2026-2027",
  dashboardSectionLabel: "Mes groupes"
};
