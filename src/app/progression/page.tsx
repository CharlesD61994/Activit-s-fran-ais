"use client";

import { Card } from "@/components/ui/card";
import { useAppStore } from "@/store/app-store";

export default function ProgressPage() {
  const { data } = useAppStore();

  const now = new Date();
  const weekAgo = new Date(now);
  weekAgo.setDate(now.getDate() - 7);
  const monthAgo = new Date(now);
  monthAgo.setMonth(now.getMonth() - 1);

  const weekly = data.scoreEvents.filter((event) => new Date(event.createdAt) >= weekAgo);
  const monthly = data.scoreEvents.filter((event) => new Date(event.createdAt) >= monthAgo);

  return (
    <div className="page">
      <div className="page-header">
        <span className="eyebrow">Suivi pédagogique</span>
        <h1>Progression</h1>
        <p>Vue d’ensemble des points, des séances et des phrases à revoir.</p>
      </div>

      <div className="grid summary-grid">
        <Card>
          <span className="eyebrow">7 derniers jours</span>
          <strong className="big-number">{weekly.reduce((sum, event) => sum + event.points, 0)}</strong>
          <p>Points attribués cette semaine.</p>
        </Card>
        <Card>
          <span className="eyebrow">30 derniers jours</span>
          <strong className="big-number">{monthly.reduce((sum, event) => sum + event.points, 0)}</strong>
          <p>Points attribués ce mois-ci.</p>
        </Card>
        <Card>
          <span className="eyebrow">À revoir</span>
          <strong className="big-number">{data.reviewStates.filter((item) => item.markedForReview).length}</strong>
          <p>Phrases marquées pour reprise.</p>
        </Card>
      </div>

      <div className="analytics-grid">
        <Card>
          <span className="eyebrow">Groupes</span>
          <h2>Progression hebdomadaire</h2>
          <div className="progress-list">
            {data.groups.map((group) => {
              const points = weekly
                .filter((event) => event.groupId === group.id)
                .reduce((sum, event) => sum + event.points, 0);
              return (
                <div className="progress-row" key={group.id}>
                  <strong>{group.name}</strong>
                  <div className="progress-track">
                    <span style={{ width: `${Math.min(100, points * 5)}%` }} />
                  </div>
                  <span>{points} pts</span>
                </div>
              );
            })}
          </div>
        </Card>

        <Card>
          <span className="eyebrow">Révision</span>
          <h2>Phrases à reprendre</h2>
          <div className="review-list">
            {data.reviewStates.filter((item) => item.markedForReview).map((item) => {
              const sentence = data.sentences.find((sentence) => sentence.id === item.sentenceId);
              const group = data.groups.find((group) => group.id === item.groupId);
              return (
                <div className="review-row" key={item.id}>
                  <div>
                    <strong>{sentence?.title ?? "Phrase supprimée"}</strong>
                    <small>{group?.name ?? "Groupe inconnu"}</small>
                  </div>
                  <span>Difficulté {item.difficultyScore}/5</span>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
}
