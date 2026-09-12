import type { CSSProperties } from "react";
import clsx from "clsx";

/**
 * La señal viva: the one light that travels the page. Every appearance uses
 * this component; only the diameter token and the position class change, so
 * two lights that must be identical (section 6) cannot drift apart.
 */
export function Signal({
  className,
  size,
  breath = false,
}: {
  className?: string;
  /** CSS length or token for the diameter; defaults to the section 2/3 token. */
  size?: string;
  breath?: boolean;
}) {
  return (
    <span
      aria-hidden
      className={clsx("signal", breath && "signal--breath", className)}
      style={size ? ({ "--d": size } as CSSProperties) : undefined}
    />
  );
}
