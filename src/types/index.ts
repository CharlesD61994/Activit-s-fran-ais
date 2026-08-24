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
  accentColor?: string;
  shieldLabel?: string;
  weeklyObjective?: string;
  weeklyObjectivePoints?: number;
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
  | "tree_analysis"
  | "worksheet";

export type GrammarObjective =
  | "sentence_correction"
  | "text_correction"
  | "word_classes"
  | "word_groups"
  | "functions"
  | "agreements"
  | "mixed_grammar";

export type GrammarPhaseKind =
  | "correction"
  | "groups"
  | "word_classes"
  | "nuclei"
  | "functions"
  | "agreements"
  | "gender_number"
  | "table"
  | "review";

export type GrammarActionKind =
  | "find_errors"
  | "write_corrections"
  | "identify_codes"
  | "frame_groups"
  | "identify_group_types"
  | "identify_word_classes"
  | "find_nuclei"
  | "frame_functions"
  | "identify_functions"
  | "identify_donors"
  | "identify_receivers"
  | "link_agreement"
  | "identify_gender"
  | "identify_number"
  | "complete_table";

export type GrammarWorkflowAction = {
  id: string;
  kind: GrammarActionKind;
  enabled: boolean;
  optional?: boolean;
  responseMode?: "brackets" | "frame" | "click";
};

export type GrammarWorkflowPhase = {
  id: string;
  kind: GrammarPhaseKind;
  title: string;
  collapsed?: boolean;
  actions: GrammarWorkflowAction[];
  /** A review phase freezes the accumulated correction on the board. */
  reviewDurationSeconds?: 0 | 15 | 30 | 45 | 60;
};

export type AgreementCorrectionArrow = {
  id: string;
  taskTargetId: string;
  answerId: string;
  color: string;
  /** Points normalized against the sentence surface (0..1). */
  points: Array<{ x: number; y: number }>;
  /** Geometry of the authoring surface, used to re-anchor the stroke after reflow. */
  sourceGeometry?: {
    width: number;
    height: number;
    startAnchor: { x: number; y: number };
    endAnchor: { x: number; y: number };
  };
};

export type GrammarAnnotationKind =
  | "error"
  | "group"
  | "word_class"
  | "nucleus"
  | "function"
  | "donor"
  | "receiver"
  | "gender_number";

export type GrammarAnnotation = {
  id: string;
  start: number;
  end: number;
  kind: GrammarAnnotationKind;
  label?: string;
  linkedAnnotationId?: string;
  parentAnnotationId?: string;
  grammaticalGender?: "feminine" | "masculine";
  grammaticalNumber?: "singular" | "plural";
  wordClassInteractionMode?: "find_requested" | "choose_class";

  responseMode?: "click" | "frame" | "brackets" | "arrow";
  visualEffect?: {
    kind: "none" | "color" | "frame" | "brackets" | "bold" | "highlight" | "underline";
    color?: string;
  };
};
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
  grammaticalGender?: "feminine" | "masculine";
  grammaticalNumber?: "singular" | "plural";
  wordClassInteractionMode?: "find_requested" | "choose_class";
  /** Mixed activities can unlock this class immediately after the linked role is completed. */
  triggerAfterRole?: "donor" | "receiver";
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
  nucleusStart?: number;
  nucleusEnd?: number;
  nucleusText?: string;
  /** False when this group must be classified without a nucleus question. */
  analyzeNucleus?: boolean;
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
  /** Worksheet-only geometry. Kept optional for legacy tree activities. */
  width?: number;
  height?: number;
  pageId?: string;
};

export type WorksheetTableCellRole =
  | "text"
  | "answer"
  | "answer_line"
  | "choice"
  | "checkbox"
  | "order"
  | "score"
  | "criterion"
  | "total"
  | "header";

export type TreeAnalysisTableCell = {
  text: string;
  isCorrect: boolean;
  columnSpan?: number;
  rowSpan?: number;
  role?: WorksheetTableCellRole;
  answer?: string;
  background?: "white" | "gray" | "black";
  textColor?: "black" | "white";
  textAlign?: "left" | "center" | "right";
  verticalAlign?: "top" | "center" | "bottom";
  fontSize?: number;
  bold?: boolean;
  borderWidth?: 0 | 1 | 2 | 3;
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
  template?: "free" | "teaching_document";
  rectanglePreset?: "normal" | "compact";
  margins: TreeAnalysisPageMargins;
  header?: {
    nameX: number;
    nameY: number;
    groupX: number;
    groupY: number;
    fontSize: number;
    lineWidth: number;
    activityType?: string;
    activityTitle?: string;
    showPageBadge?: boolean;
  };
  mainTitle?: {
    enabled: boolean;
    prefix: string;
    title: string;
    subtitle?: string;
    scoreTotal?: number;
  };
  taskCallout?: {
    enabled: boolean;
    text: string;
  };
  readerMode?: "tree_only" | "tree_functions" | "tree_tables" | "groups_then_tree";
  readerPhaseOrder?: Array<"groups" | "nuclei" | "linked_nodes" | "functions" | "remaining_nodes" | "tables">;
};

export type TreeAnalysisQuestionBadge = {
  id: string;
  pageId: string;
  x: number;
  y: number;
  number: number;
};

export type TreeAnalysisTextAnnotation = {
  id: string;
  start: number;
  end: number;
  color?: string | null;
  framed?: boolean;
  bold?: boolean;
  fontScale?: number;
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
  textAlign?: "left" | "center" | "justify";
  bold?: boolean;
  showLineNumbers?: boolean;
  annotations: TreeAnalysisTextAnnotation[];
};

export type TreeAnalysisInteraction = {
  id: string;
  textBoxId: string;
  start: number;
  end: number;
  kind: "function" | "group" | "nucleus";
  label: string;
  instruction: string;
  linkedNodeId?: string;
  authorMark?: "frame" | "red" | "blue" | "green";
  nucleusWordClass?: WordClass;
  responseMode?: "click" | "frame";
};

export type TreeAnalysisFlowPreset =
  | "tree_functions_tables"
  | "groups_tree_tables"
  | "custom";

export type TreeAnalysisFlow = {
  preset: TreeAnalysisFlowPreset;
  orderedStepIds: string[];
  selectionTolerance: "strict" | "normal" | "permissive";
};

export type TreeAnalysisTable = {
  id: string;
  x: number;
  y: number;
  rows: number;
  columns: number;
  cells: TreeAnalysisTableCell[];
  width?: number;
  rowHeights?: number[];
  columnWidths?: number[];
  kind?: "free" | "structured" | "choice" | "sequence" | "association" | "compact_rubric" | "rubric";
  pageId?: string;
};

export type AgreementRelation = {
  id: string;
  donorId: string;
  receiverIds: string[];
  /** Receivers for which the student must draw an arrow. */
  arrowReceiverIds?: string[];
};

export type WorksheetAnswerLines = {
  id: string;
  pageId: string;
  x: number;
  y: number;
  width: number;
  lineCount: number;
  lineSpacing: number;
  answer: string;
  answerFontSize: number;
  answerBold?: boolean;
  answerTextAlign?: "left" | "center" | "justify";
  interactive?: boolean;
};

export type WorksheetCheckboxMark = {
  id: string;
  pageId: string;
  x: number;
  y: number;
  size: number;
  checked?: boolean;
};

export type WorksheetDimensionBand = {
  id: string;
  pageId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  dimension: "Compréhension" | "Interprétation" | "Réaction" | "Appréciation";
};

export type WorksheetImage = {
  id: string;
  pageId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  src: string;
  alt: string;
  wrapText: boolean;
  layoutMode?: "wrap" | "front" | "behind";
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
  primaryObjective?: GrammarObjective;
  isMixedActivity?: boolean;
  workflowPhases?: GrammarWorkflowPhase[];
  grammarAnnotations?: GrammarAnnotation[];
  originalText: string;
  difficulty: SentenceDifficulty;
  tags: string[];
  corrections: SentenceCorrection[];
  selectedWordClasses?: WordClass[];
  wordClassTargets?: WordClassTarget[];
  agreementRelationsEnabled?: boolean;
  agreementRelations?: AgreementRelation[];
  agreementCorrectionArrows?: AgreementCorrectionArrow[];
  wordGroupTargets?: WordGroupTarget[];
  treeAnalysisPage?: TreeAnalysisPageConfig;
  treeAnalysisNodes?: TreeAnalysisNode[];
  treeAnalysisRelations?: TreeAnalysisRelation[];
  treeAnalysisScoreBoxes?: TreeAnalysisScoreBox[];
  treeAnalysisTables?: TreeAnalysisTable[];
  treeAnalysisPhrases?: TreeAnalysisPhrase[];
  treeAnalysisDocumentPages?: TreeAnalysisDocumentPage[];
  treeAnalysisQuestionBadges?: TreeAnalysisQuestionBadge[];
  treeAnalysisTextBoxes?: TreeAnalysisTextBox[];
  treeAnalysisInteractions?: TreeAnalysisInteraction[];
  treeAnalysisFlow?: TreeAnalysisFlow;
  worksheetAnswerLines?: WorksheetAnswerLines[];
  worksheetCheckBoxes?: WorksheetCheckboxMark[];
  worksheetDimensionBands?: WorksheetDimensionBand[];
  worksheetImages?: WorksheetImage[];
  worksheetReaderOrder?: string[];
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
};
