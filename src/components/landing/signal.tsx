import type { CSSProperties, Ref } from "react";
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
  style,
  ref,
}: {
  className?: string;
  /** CSS length or token for the diameter; defaults to the section 2/3 token. */
  size?: string;
  breath?: boolean;
  /** Position tokens only (such as section 6's direction); never colour or size. */
  style?: CSSProperties;
  /** For a script that moves the light itself (light-relay.tsx). */
  ref?: Ref<HTMLSpanElement>;
}) {
  return (
    <span
      ref={ref}
      aria-hidden
      className={clsx("signal", breath && "signal--breath", className)}
      style={size || style ? ({ ...style, ...(size ? { "--d": size } : null) } as CSSProperties) : undefined}
    />
  );
}
