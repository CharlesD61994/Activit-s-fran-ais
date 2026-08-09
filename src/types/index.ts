export type ThemeId =
  | "colorful"
  | "notebook"
  | "neutral"
  | "minimal"
  | "dark"
  | "halloween"
  | "christmas"
  | "winter";

export type SchoolLevel = {
  id: string;
  name: string;
  order: number;
};

export type SchoolYear = {
  id: string;
  name: string;
  order: number;
};

export type ClassGroup = {
  id: string;
  levelId: string;
  schoolYearId?: string;
  name: string;
  description?: string;
  themeId: ThemeId;
  totalPoints: number;
  sentenceCount: number;
  studentPortalEnabled?: boolean;
  studentAccessCode?: string;
};

export type Team = {
  id: string;
  groupId: string;
  name: string;
  icon?: string;
  points: number;
  members?: string[];
};

export type CorrectionCategory =
  | "orthography"
  | "agreement"
  | "conjugation"
  | "participle"
  | "homophone"
  | "syntax"
  | "punctuation"
  | "vocabulary"
  | "other";

export type CorrectionCode = {
  id: string;
  code: string;
  name: string;
  description?: string;
  category: CorrectionCategory;
  color?: string;
  isActive?: boolean;
};

export type SentenceDifficulty = "easy" | "medium" | "hard";

export type ActivityType =
  | "sentence_correction"
  | "text_correction"
  | "word_classes"
  | "word_groups"
  | "tree_analysis";
export type AssignmentStatus = "todo" | "in_progress" | "completed" | "archived";

export type WordClass =
  | "noun"
  | "determiner"
  | "verb"
  | "preposition"
  | "adverb"
  | "adjective"
  | "pronoun"
  | "conjunction"
  | "interjection";

export type WordClassTarget = {
  id: string;
  start: number;
  end: number;
  text: string;
  wordClass: WordClass;
  isAnalysisTarget?: boolean;
};



export type WordGroupType =
  | "GN"
  | "GV"
  | "GAdj"
  | "GAdv"
  | "GPrep";

export type WordGroupTarget = {
  id: string;
  start: number;
  end: number;
  text: string;
  groupType: WordGroupType;
  nucleusStart: number;
  nucleusEnd: number;
  nucleusText: string;
  mode?: "standard" | "contracted_nested";
  contractedGnText?: string;
  contractedPrepNucleus?: "de" | "à";
};

export type TreeAnalysisPageConfig = {
  pageSize: "letter";
  orientation: "landscape";
  logicalWidth: number;
  logicalHeight: number;
  marginX: number;
  marginTop: number;
  sentenceTop: number;
  sentenceFontSize: number;
  sentenceFontFamily: string;
  sentenceFontWeight: number;
  nodeWidth?: number;
  nodeHeight?: number;
};

export type TreeAnalysisNode = {
  id: string;
  x: number;
  y: number;
  phraseId?: string;
  pageId?: string;
  groupType?: WordGroupType;
  wordClass?: WordClass;
};

export type TreeAnalysisRelation = {
  id: string;
  parentNodeId: string;
  childNodeId: string;
};

export type TreeAnalysisScoreBox = {
  id: string;
  x: number;
  y: number;
  total: number;
  earned?: number;
  size?: "normal" | "large";
  pageId?: string;
};

export type TreeAnalysisTableCell = {
  text: string;
  isCorrect: boolean;
  columnSpan?: number;
};

export type TreeAnalysisPhrase = {
  id: string;
  pageId?: string;
  text: string;
  x: number;
  y: number;
  fontSize: number;
  nodeWidth: number;
  nodeHeight: number;
};

export type TreeAnalysisPageMargins = {
  top: number;
  right: number;
  bottom: number;
  left: number;
};

export type TreeAnalysisDocumentPage = {
  id: string;
  orientation: "portrait" | "landscape";
  margins: TreeAnalysisPageMargins;
  header?: {
    nameX: number;
    nameY: number;
    groupX: number;
    groupY: number;
    fontSize: number;
    lineWidth: number;
  };
};

export type TreeAnalysisTextAnnotation = {
  id: string;
  start: number;
  end: number;
  color?: string | null;
  framed?: boolean;
  bold?: boolean;
};

export type TreeAnalysisTextBox = {
  id: string;
  pageId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
  fontSize: number;
  annotations: TreeAnalysisTextAnnotation[];
};

export type TreeAnalysisTable = {
  id: string;
  x: number;
  y: number;
  rows: number;
  columns: number;
  cells: TreeAnalysisTableCell[];
  pageId?: string;
};

export type AgreementRelation = {
  id: string;
  donorId: string;
  receiverIds: string[];
};

export type SentenceCorrection = {
  id: string;
  start: number;
  end: number;
  originalText: string;
  correctedText: string;
  correctionCodeId: string;
  points: number;
  revealOrder: number;
  explanation?: string;
};

export type Sentence = {
  id: string;
  activityType?: ActivityType;
  levelId: string;
  title: string;
  originalText: string;
  difficulty: SentenceDifficulty;
  tags: string[];
  corrections: SentenceCorrection[];
  selectedWordClasses?: WordClass[];
  wordClassTargets?: WordClassTarget[];
  agreementRelationsEnabled?: boolean;
  agreementRelations?: AgreementRelation[];
  wordGroupTargets?: WordGroupTarget[];
  treeAnalysisPage?: TreeAnalysisPageConfig;
  treeAnalysisNodes?: TreeAnalysisNode[];
  treeAnalysisRelations?: TreeAnalysisRelation[];
  treeAnalysisScoreBoxes?: TreeAnalysisScoreBox[];
  treeAnalysisTables?: TreeAnalysisTable[];
  treeAnalysisPhrases?: TreeAnalysisPhrase[];
  treeAnalysisDocumentPages?: TreeAnalysisDocumentPage[];
  treeAnalysisTextBoxes?: TreeAnalysisTextBox[];
  assignedGroupIds: string[];
  competitionEnabled?: boolean;
  assignmentStatusByGroup?: Record<string, AssignmentStatus>;
  assignmentProgressByGroup?: Record<string, number>;
  showCorrectionCount?: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ScoreReason =
  | "correction"
  | "justification"
  | "bonus"
  | "manual"
  | "undo";

export type ScoreEvent = {
  id: string;
  groupId: string;
  teamId?: string;
  sentenceId: string;
  sessionId: string;
  correctionId?: string;
  correctionCodeId?: string;
  points: number;
  reason: ScoreReason;
  createdAt: string;
};

export type PresentationSession = {
  id: string;
  groupId: string;
  sentenceId: string;
  revealedCorrectionIds: string[];
  startedAt: string;
  completedAt?: string;
};

export type SentenceCollection = {
  id: string;
  levelId: string;
  name: string;
  description?: string;
  sentenceIds: string[];
  assignedGroupIds?: string[];
  competitionEnabled?: boolean;
  assignmentStatusByGroup?: Record<string, AssignmentStatus>;
  assignmentProgressByGroup?: Record<string, number>;
  scheduledDate?: string;
  createdAt: string;
  updatedAt: string;
};

export type PlannedSessionStatus = "planned" | "in_progress" | "completed";

export type PlannedSession = {
  id: string;
  groupId: string;
  sourceSessionId?: string;
  title: string;
  scheduledDate: string;
  sentenceIds: string[];
  status: PlannedSessionStatus;
  currentSentenceIndex: number;
  createdAt: string;
  updatedAt: string;
};


export type CompetitionStanding = {
  teamId: string;
  teamName: string;
  teamIcon?: string;
  score: number;
  rank: number;
};

export type CompetitionResult = {
  id: string;
  groupId: string;
  sourceType: "activity" | "session";
  sourceId: string;
  title: string;
  standings: CompetitionStanding[];
  completedAt: string;
};

export type SentenceReviewState = {
  id: string;
  groupId: string;
  sentenceId: string;
  markedForReview: boolean;
  difficultyScore: number;
  lastReviewedAt?: string;
  nextReviewAt?: string;
};

export type AppData = {
  dataVersion: number;
  schoolYears: SchoolYear[];
  levels: SchoolLevel[];
  groups: ClassGroup[];
  teams: Team[];
  correctionCodes: CorrectionCode[];
  sentences: Sentence[];
  collections: SentenceCollection[];
  plannedSessions: PlannedSession[];
  reviewStates: SentenceReviewState[];
  scoreEvents: ScoreEvent[];
  competitionResults: CompetitionResult[];
  dashboardTitle: string;
  dashboardSectionLabel: string;
  globalThemeId: ThemeId;
};


export type PresentationMode = "classic" | "hint" | "teacher";
export type PresentationAnimation = "none" | "fade" | "slide" | "highlight";
