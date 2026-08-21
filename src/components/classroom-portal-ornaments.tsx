import { Star } from "lucide-react";

export function ClassroomGroupEmblem({
  label,
  compact = false
}: {
  label: string;
  compact?: boolean;
}) {
  return (
    <span
      className={
        "classroom-ornament-shield" + (compact ? " is-compact" : "")
      }
      aria-label={`Écusson ${label}`}
    >
      <svg viewBox="0 0 156 156" role="img" aria-hidden="true">
        <path
          className="classroom-ornament-shield-body"
          d="M78 10 129 29l-5 73c-12 20-27 34-46 44-19-10-34-24-46-44l-5-73Z"
        />
        <path
          className="classroom-ornament-shield-line"
          d="M78 19 120 35l-4 63c-10 17-23 29-38 38-15-9-28-21-38-38l-4-63Z"
        />
        <path
          className="classroom-ornament-shield-line subtle"
          d="M78 28 111 41l-3 53c-8 14-18 24-30 32-12-8-22-18-30-32l-3-53Z"
        />
        <path
          className="classroom-ornament-star"
          d="m78 35 3.2 6.5 7.2 1-5.2 5.1 1.2 7.2-6.4-3.4-6.4 3.4 1.2-7.2-5.2-5.1 7.2-1Z"
        />
        <text x="78" y="93" textAnchor="middle">
          {label}
        </text>
      </svg>
    </span>
  );
}

export function ClassroomPointsMedal({ compact = false }: { compact?: boolean }) {
  return (
    <span
      className={
        "classroom-ornament-medal" + (compact ? " is-compact" : "")
      }
      aria-hidden="true"
    >
      <span className="classroom-ornament-medal-ring">
        <Star fill="currentColor" />
      </span>
    </span>
  );
}
