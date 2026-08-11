import type { CSSProperties } from "react";

type InlineBracketTarget = {
  id: string;
  start: number;
  end: number;
};

type Props = {
  tokenId: string;
  tokenStart: number;
  tokenEnd: number;
  leftTargets: InlineBracketTarget[];
  rightTargets: InlineBracketTarget[];
  keyPrefix?: string;
};

function bracketOffset(index: number): CSSProperties {
  return { left: `${-.09 - index * .1}em` };
}

function rightBracketOffset(index: number): CSSProperties {
  return { right: `${-.09 - index * .1}em` };
}

export function InlineRangeBrackets({
  tokenId,
  tokenStart,
  tokenEnd,
  leftTargets,
  rightTargets,
  keyPrefix = "inline"
}: Props) {
  const startsHere = leftTargets.filter(
    (target) => tokenStart <= target.start && tokenEnd > target.start
  );
  const endsHere = rightTargets.filter(
    (target) => tokenStart < target.end && tokenEnd >= target.end
  );

  return (
    <>
      {startsHere.map((target, index) => (
        <i
          aria-hidden="true"
          className="word-group-inline-bracket left"
          key={`${keyPrefix}-left-${tokenId}-${target.id}`}
          style={bracketOffset(index)}
        />
      ))}
      {endsHere.map((target, index) => (
        <i
          aria-hidden="true"
          className="word-group-inline-bracket right"
          key={`${keyPrefix}-right-${tokenId}-${target.id}`}
          style={rightBracketOffset(index)}
        />
      ))}
    </>
  );
}