import type { Missing } from "@/content/landing/clear-light";

/** Shared identities and portraits; translated study roles and bios live in TEAM.members. */
export interface TeamMember {
  readonly name: string | null;
  readonly photo: string | null;
  readonly href: string | null;
  /**
   * For a photograph that is not a centred square: which part the circle shows
   * (`position`, as CSS object-position) and how far to move in on it (`zoom`,
   * around `origin`, a point of the circle).
   */
  readonly crop?: { readonly position?: string; readonly zoom?: number; readonly origin?: string };
}

/** Portraits supplied by the study team. Profile links are optional. */
export const TEAM_MEMBERS: readonly TeamMember[] = [
  { name: "David Glowacki, PhD", photo: "/landing/media/portraits/Transparent/david-glowacki.png", href: null },
  { name: "Joe Hardy", photo: "/landing/media/portraits/Transparent/joe-hardy 1.png", href: null },
  { name: "Justin \"Lama Karma\" Wall", photo: "/landing/media/portraits/Transparent/justin-wall 1.png", href: null },
  { name: "Valérie Bonnelle", photo: "/landing/media/portraits/Transparent/Valérie+Bonnelle 1.png", href: null },
  { name: "Sila Sobrado", photo: "/landing/media/portraits/Transparent/20240711_193214+(1) (1) 1.png", href: null },
  { name: "Catherine Andreu", photo: "/landing/media/portraits/Transparent/cathherine-andrew.png", href: null },
  { name: "Jose Montemayor Alba", photo: "/landing/media/portraits/Transparent/JEMA Headshot_Color_2 1.png", href: null },
  { name: "Joana Vidal", photo: "/landing/media/portraits/Transparent/joana-hero 1.png", href: null },
];

export const TEAM_PENDING: Missing = {
  missing: true,
  key: "EQUIPO_MIEMBROS",
  needs: "Nombre, rol, biografía breve, fotografía y enlace de cada una de las ocho personas del equipo",
};

/** The role and biography one language gives a member. */
export interface TeamMemberCopy {
  /** Left out while the person's role has not been supplied. */
  readonly role?: string;
  readonly bio: string;
}

/** True once a slot has everything the section shows without a placeholder. */
export function isComplete(member: TeamMember, copy: TeamMemberCopy | undefined): boolean {
  return Boolean(member.name && member.photo && copy?.role && copy.bio);
}

/** The team marker, for the publication gate, while any slot is incomplete in Spanish (the source language). */
export function teamMissing(membersCopy: readonly TeamMemberCopy[]): readonly Missing[] {
  return TEAM_MEMBERS.every((m, i) => isComplete(m, membersCopy[i])) ? [] : [TEAM_PENDING];
}
