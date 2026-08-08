import type { ComponentPropsWithoutRef } from "react";

type CardProps = ComponentPropsWithoutRef<"section">;

export function Card({ children, className = "", ...props }: CardProps) {
  return <section className={`card ${className}`} {...props}>{children}</section>;
}
