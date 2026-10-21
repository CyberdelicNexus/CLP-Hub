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

/**
 * Portraits supplied by the study team, normalised by scripts/team-portraits.mjs
 * so every head sits at the same height and size (D-122). Profile links are optional.
 */
export const TEAM_MEMBERS: readonly TeamMember[] = [
  { name: "Dr. David Glowacki, MA, PhD", photo: "/landing/media/portraits/cards/david-glowacki.webp", href: null },
  { name: "Dr. Joe Hardy, PhD", photo: "/landing/media/portraits/cards/joe-hardy.webp", href: null },
  { name: "Justin \"Lama Karma\" Wall", photo: "/landing/media/portraits/cards/justin-wall.webp", href: null },
  { name: "Dr. Valérie Bonnelle, PhD", photo: "/landing/media/portraits/cards/valerie-bonnelle.webp", href: null },
  { name: "Sila Sobrado", photo: "/landing/media/portraits/cards/sila-sobrado.webp", href: null },
  { name: "Dr. Catherine Andreu, PhD", photo: "/landing/media/portraits/cards/catherine-andreu.webp", href: null },
  { name: "Jose Montemayor Alba", photo: "/landing/media/portraits/cards/jose-montemayor.webp", href: null },
  { name: "Dr. Joana Vidal, PhD", photo: "/landing/media/portraits/cards/joana-vidal.webp", href: null },
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
