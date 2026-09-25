import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { TEAM_NAV } from "@/domain/navigation";

describe("sidebar icons", () => {
  /**
   * A section with no entry in the icon map renders with no icon and nothing
   * complains: that is how "Consultas" shipped without one (D-088). Every nav
   * section needs a line in `ICONS`.
   */
  it("gives every team nav section an icon", () => {
    const source = readFileSync(join(process.cwd(), "src/components/team/sidebar-nav.tsx"), "utf8");
    const map = source.slice(source.indexOf("const ICONS"), source.indexOf("};", source.indexOf("const ICONS")));
    const missing = TEAM_NAV.map((s) => s.key).filter((key) => !new RegExp(`\\b${key}:`).test(map));
    expect(missing).toEqual([]);
  });
});
