"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { demoData } from "@/data/demo-data";
import { useAuth } from "@/features/auth/auth-provider";
import { createRepository } from "@/lib/repository";
import type {
  AppData,
  AssignmentStatus,
  ClassGroup,
  CompetitionResult,
  CorrectionCode,
  PlannedSession,
  SchoolYear,
  ScoreEvent,
  Sentence,
  SentenceCollection,
  SentenceReviewState,
  Team
} from "@/types";

type AppStoreValue = {
  data: AppData;
  hydrated: boolean;
  syncing: boolean;
  addGroup: (group: ClassGroup) => void;
  deleteGroup: (groupId: string) => void;
  resetGroupPoints: (groupId: string) => void;
  setGroupPoints: (groupId: string, points: number) => void;
  updateGroupAccentColor: (groupId: string, accentColor: string) => void;
  updateGroupShieldLabel: (groupId: string, shieldLabel: string) => void;
  saveSchoolYear: (schoolYear: SchoolYear) => void;
  deleteSchoolYear: (schoolYearId: string) => void;
  updateGroupObjective: (groupId: string, objective: string, targetPoints: number) => void;
  setDashboardTitle: (title: string) => void;
  setDashboardSectionLabel: (label: string) => void;
  saveSentence: (sentence: Sentence) => void;
  toggleActivityCompetition: (sentenceId: string) => void;
  toggleSessionCompetition: (sessionId: string) => void;
  setActivityAssignmentStatus: (
    sentenceId: string,
    groupId: string,
    status: AssignmentStatus,
    progress?: number
  ) => void;
  setSessionAssignmentStatus: (
    sessionId: string,
    groupId: string,
    status: AssignmentStatus,
    progress?: number
  ) => void;
  saveCompetitionResult: (result: CompetitionResult) => void;
  deleteSentence: (sentenceId: string) => void;
  duplicateSentence: (sentenceId: string) => string | null;
  addScoreEvent: (event: ScoreEvent) => void;
  removeScoreEvent: (eventId: string) => void;
  saveTeam: (team: Team) => void;
  deleteTeam: (teamId: string) => void;
  saveCollection: (collection: SentenceCollection) => void;
  deleteCollection: (collectionId: string) => void;
  savePlannedSession: (session: PlannedSession) => void;
  deletePlannedSession: (sessionId: string) => void;
  saveReviewState: (reviewState: SentenceReviewState) => void;
  saveCorrectionCode: (code: CorrectionCode) => void;
  deleteCorrectionCode: (codeId: string) => void;
  resetData: () => Promise<void>;
};

const AppStoreContext = createContext<AppStoreValue | null>(null);

function cloneDemoData(): AppData {
  return JSON.parse(JSON.stringify(demoData)) as AppData;
}

export function AppStoreProvider({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [data, setData] = useState<AppData>(() => cloneDemoData());
  const [hydrated, setHydrated] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const firstSave = useRef(true);

  useEffect(() => {
    if (authLoading) return;

    let cancelled = false;
    const repository = createRepository(Boolean(user));

    repository.load()
      .then((loaded) => {
        if (cancelled) return;
        setData(loaded);
        setHydrated(true);
        firstSave.current = true;
      })
      .catch(() => {
        if (cancelled) return;
        setData(cloneDemoData());
        setHydrated(true);
      });

    return () => {
      cancelled = true;
    };
  }, [authLoading, user]);

  useEffect(() => {
    if (!hydrated) return;
    if (firstSave.current) {
      firstSave.current = false;
      return;
    }

    const repository = createRepository(Boolean(user));
    const timeout = window.setTimeout(() => {
      setSyncing(true);
      repository.save(data)
        .finally(() => setSyncing(false));
    }, 350);

    return () => window.clearTimeout(timeout);
  }, [data, hydrated, user]);

  const value = useMemo<AppStoreValue>(() => ({
    data,
    hydrated,
    syncing,
    addGroup: (group) =>
      setData((current) => ({
        ...current,
        groups: [...current.groups, group]
      })),
    deleteGroup: (groupId) =>
      setData((current) => ({
        ...current,
        groups: current.groups.filter((group) => group.id !== groupId),
        teams: current.teams.filter((team) => team.groupId !== groupId),
        plannedSessions: current.plannedSessions.filter(
          (session) => session.groupId !== groupId
        ),
        reviewStates: current.reviewStates.filter(
          (state) => state.groupId !== groupId
        ),
        scoreEvents: current.scoreEvents.filter(
          (event) => event.groupId !== groupId
        ),
        sentences: current.sentences.map((sentence) => ({
          ...sentence,
          assignedGroupIds: sentence.assignedGroupIds.filter(
            (id) => id !== groupId
          )
        })),
        collections: current.collections.map((session) => ({
          ...session,
          assignedGroupIds: (session.assignedGroupIds ?? []).filter(
            (id) => id !== groupId
          )
        }))
      })),
    resetGroupPoints: (groupId) =>
      setData((current) => ({
        ...current,
        groups: current.groups.map((group) =>
          group.id === groupId ? { ...group, totalPoints: 0 } : group
        ),
        teams: current.teams.map((team) =>
          team.groupId === groupId ? { ...team, points: 0 } : team
        ),
        scoreEvents: current.scoreEvents.filter(
          (event) => event.groupId !== groupId
        )
      })),
    setGroupPoints: (groupId, points) =>
      setData((current) => ({
        ...current,
        groups: current.groups.map((group) =>
          group.id === groupId ? { ...group, totalPoints: points } : group
        ),
        scoreEvents: [
          ...current.scoreEvents.filter((event) => event.groupId !== groupId),
          ...(points !== 0
            ? [{
                id: crypto.randomUUID(),
                groupId,
                sentenceId: "manual-score",
                sessionId: crypto.randomUUID(),
                points,
                reason: "manual" as const,
                createdAt: new Date().toISOString()
              }]
            : [])
        ]
      })),
    updateGroupAccentColor: (groupId, accentColor) =>
      setData((current) => ({
        ...current,
        groups: current.groups.map((group) =>
          group.id === groupId ? { ...group, accentColor } : group
        )
      })),
    updateGroupShieldLabel: (groupId, shieldLabel) =>
      setData((current) => ({
        ...current,
        groups: current.groups.map((group) =>
          group.id === groupId ? { ...group, shieldLabel: shieldLabel.replace(/\D/g, "").slice(0, 4) } : group
        )
      })),
    saveSchoolYear: (schoolYear) =>
      setData((current) => {
        const exists = current.schoolYears.some((item) => item.id === schoolYear.id);
        return {
          ...current,
          schoolYears: exists
            ? current.schoolYears.map((item) => item.id === schoolYear.id ? schoolYear : item)
            : [...current.schoolYears, schoolYear]
        };
      }),
    deleteSchoolYear: (schoolYearId) =>
      setData((current) => {
        const deletedGroupIds = current.groups
          .filter((group) => group.schoolYearId === schoolYearId)
          .map((group) => group.id);

        return {
          ...current,
          schoolYears: current.schoolYears.filter((item) => item.id !== schoolYearId),
          groups: current.groups.filter((group) => group.schoolYearId !== schoolYearId),
          teams: current.teams.filter((team) => !deletedGroupIds.includes(team.groupId)),
          plannedSessions: current.plannedSessions.filter(
            (session) => !deletedGroupIds.includes(session.groupId)
          ),
          reviewStates: current.reviewStates.filter(
            (state) => !deletedGroupIds.includes(state.groupId)
          ),
          scoreEvents: current.scoreEvents.filter(
            (event) => !deletedGroupIds.includes(event.groupId)
          ),
          sentences: current.sentences.map((sentence) => ({
            ...sentence,
            assignedGroupIds: sentence.assignedGroupIds.filter(
              (groupId) => !deletedGroupIds.includes(groupId)
            )
          }))
        };
      }),
    updateGroupObjective: (groupId, weeklyObjective, weeklyObjectivePoints) =>
      setData((current) => ({
        ...current,
        groups: current.groups.map((group) =>
          group.id === groupId
            ? { ...group, weeklyObjective, weeklyObjectivePoints }
            : group
        )
      })),
    setDashboardTitle: (dashboardTitle) =>
      setData((current) => ({ ...current, dashboardTitle })),
    setDashboardSectionLabel: (dashboardSectionLabel) =>
      setData((current) => ({ ...current, dashboardSectionLabel })),
    saveSentence: (sentence) =>
      setData((current) => {
        const exists = current.sentences.some((item) => item.id === sentence.id);
        return {
          ...current,
          sentences: exists
            ? current.sentences.map((item) => item.id === sentence.id ? sentence : item)
            : [sentence, ...current.sentences]
        };
      }),
    toggleActivityCompetition: (sentenceId) =>
      setData((current) => ({
        ...current,
        sentences: current.sentences.map((sentence) =>
          sentence.id === sentenceId
            ? {
                ...sentence,
                competitionEnabled: !sentence.competitionEnabled,
                updatedAt: new Date().toISOString()
              }
            : sentence
        )
      })),
    toggleSessionCompetition: (sessionId) =>
      setData((current) => ({
        ...current,
        collections: current.collections.map((session) =>
          session.id === sessionId
            ? {
                ...session,
                competitionEnabled: !session.competitionEnabled,
                updatedAt: new Date().toISOString()
              }
            : session
        ),
        plannedSessions: current.plannedSessions.map((session) =>
          session.sourceSessionId === sessionId
            ? { ...session, updatedAt: new Date().toISOString() }
            : session
        )
      })),
    setActivityAssignmentStatus: (sentenceId, groupId, status, progress = 0) =>
      setData((current) => ({
        ...current,
        sentences: current.sentences.map((sentence) =>
          sentence.id === sentenceId
            ? {
                ...sentence,
                assignmentStatusByGroup: {
                  ...(sentence.assignmentStatusByGroup ?? {}),
                  [groupId]: status
                },
                assignmentProgressByGroup: {
                  ...(sentence.assignmentProgressByGroup ?? {}),
                  [groupId]: progress
                },
                updatedAt: new Date().toISOString()
              }
            : sentence
        )
      })),
    setSessionAssignmentStatus: (sessionId, groupId, status, progress = 0) =>
      setData((current) => ({
        ...current,
        collections: current.collections.map((session) =>
          session.id === sessionId
            ? {
                ...session,
                assignmentStatusByGroup: {
                  ...(session.assignmentStatusByGroup ?? {}),
                  [groupId]: status
                },
                assignmentProgressByGroup: {
                  ...(session.assignmentProgressByGroup ?? {}),
                  [groupId]: progress
                },
                updatedAt: new Date().toISOString()
              }
            : session
        )
      })),
    saveCompetitionResult: (result) =>
      setData((current) => ({
        ...current,
        competitionResults: [result, ...current.competitionResults]
      })),
    deleteSentence: (sentenceId) =>
      setData((current) => ({
        ...current,
        sentences: current.sentences.filter((item) => item.id !== sentenceId)
      })),
    duplicateSentence: (sentenceId) => {
      let newId: string | null = null;
      setData((current) => {
        const source = current.sentences.find((item) => item.id === sentenceId);
        if (!source) return current;
        newId = crypto.randomUUID();
        const now = new Date().toISOString();
        const copy: Sentence = {
          ...source,
          id: newId,
          title: `${source.title} — copie`,
          corrections: source.corrections.map((correction) => ({
            ...correction,
            id: crypto.randomUUID()
          })),
          createdAt: now,
          updatedAt: now
        };
        return { ...current, sentences: [copy, ...current.sentences] };
      });
      return newId;
    },
    addScoreEvent: (event) =>
      setData((current) => ({
        ...current,
        scoreEvents: [...current.scoreEvents, event],
        groups: current.groups.map((group) =>
          group.id === event.groupId
            ? { ...group, totalPoints: group.totalPoints + event.points }
            : group
        ),
        teams: current.teams.map((team) =>
          event.teamId && team.id === event.teamId
            ? { ...team, points: team.points + event.points }
            : team
        )
      })),
    removeScoreEvent: (eventId) =>
      setData((current) => {
        const event = current.scoreEvents.find((item) => item.id === eventId);
        if (!event) return current;
        return {
          ...current,
          scoreEvents: current.scoreEvents.filter((item) => item.id !== eventId),
          groups: current.groups.map((group) =>
            group.id === event.groupId
              ? { ...group, totalPoints: group.totalPoints - event.points }
              : group
          ),
          teams: current.teams.map((team) =>
            event.teamId && team.id === event.teamId
              ? { ...team, points: team.points - event.points }
              : team
          )
        };
      }),
    saveTeam: (team) =>
      setData((current) => {
        const exists = current.teams.some((item) => item.id === team.id);
        return {
          ...current,
          teams: exists
            ? current.teams.map((item) => item.id === team.id ? team : item)
            : [...current.teams, team]
        };
      }),
    deleteTeam: (teamId) =>
      setData((current) => ({
        ...current,
        teams: current.teams.filter((item) => item.id !== teamId),
        scoreEvents: current.scoreEvents.map((event) =>
          event.teamId === teamId ? { ...event, teamId: undefined } : event
        )
      })),
    saveCollection: (collection) =>
      setData((current) => {
        const exists = current.collections.some((item) => item.id === collection.id);
        const assignedGroupIds = collection.assignedGroupIds ?? [];
        const now = new Date().toISOString();

        const preservedSessions = current.plannedSessions.filter(
          (session) => session.sourceSessionId !== collection.id
        );

        const generatedSessions: PlannedSession[] = assignedGroupIds.map((groupId) => {
          const existing = current.plannedSessions.find(
            (session) =>
              session.sourceSessionId === collection.id &&
              session.groupId === groupId
          );

          return {
            id: existing?.id ?? crypto.randomUUID(),
            groupId,
            sourceSessionId: collection.id,
            title: collection.name,
            scheduledDate:
              collection.scheduledDate ??
              existing?.scheduledDate ??
              new Date().toISOString().slice(0, 10),
            sentenceIds: collection.sentenceIds,
            status: existing?.status ?? "planned",
            currentSentenceIndex: existing?.currentSentenceIndex ?? 0,
            createdAt: existing?.createdAt ?? now,
            updatedAt: now
          };
        });

        return {
          ...current,
          collections: exists
            ? current.collections.map((item) =>
                item.id === collection.id ? collection : item
              )
            : [collection, ...current.collections],
          plannedSessions: [...generatedSessions, ...preservedSessions]
        };
      }),
    deleteCollection: (collectionId) =>
      setData((current) => ({
        ...current,
        collections: current.collections.filter(
          (item) => item.id !== collectionId
        ),
        plannedSessions: current.plannedSessions.filter(
          (session) => session.sourceSessionId !== collectionId
        )
      })),
    savePlannedSession: (session) =>
      setData((current) => {
        const exists = current.plannedSessions.some((item) => item.id === session.id);
        return {
          ...current,
          plannedSessions: exists
            ? current.plannedSessions.map((item) => item.id === session.id ? session : item)
            : [session, ...current.plannedSessions]
        };
      }),
    deletePlannedSession: (sessionId) =>
      setData((current) => ({
        ...current,
        plannedSessions: current.plannedSessions.filter((item) => item.id !== sessionId)
      })),
    saveReviewState: (reviewState) =>
      setData((current) => {
        const exists = current.reviewStates.some((item) => item.id === reviewState.id);
        return {
          ...current,
          reviewStates: exists
            ? current.reviewStates.map((item) => item.id === reviewState.id ? reviewState : item)
            : [...current.reviewStates, reviewState]
        };
      }),
    saveCorrectionCode: (code) =>
      setData((current) => {
        const exists = current.correctionCodes.some((item) => item.id === code.id);
        return {
          ...current,
          correctionCodes: exists
            ? current.correctionCodes.map((item) => item.id === code.id ? code : item)
            : [...current.correctionCodes, code]
        };
      }),
    deleteCorrectionCode: (codeId) =>
      setData((current) => {
        const used = current.sentences.some((sentence) =>
          sentence.corrections.some((correction) =>
            correction.correctionCodeId === codeId
          )
        );
        if (used) return current;
        return {
          ...current,
          correctionCodes: current.correctionCodes.filter((item) => item.id !== codeId)
        };
      }),
    resetData: async () => {
      const repository = createRepository(Boolean(user));
      const fresh = await repository.reset();
      setData(fresh);
    }
  }), [data, hydrated, syncing, user]);

  return (
    <AppStoreContext.Provider value={value}>
      {children}
    </AppStoreContext.Provider>
  );
}

export function useAppStore() {
  const context = useContext(AppStoreContext);
  if (!context) throw new Error("useAppStore doit être utilisé dans AppStoreProvider.");
  return context;
}
