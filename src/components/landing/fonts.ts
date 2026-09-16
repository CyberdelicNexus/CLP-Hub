import { IBM_Plex_Mono, Manrope, Poppins } from "next/font/google";

/**
 * The public site's faces, declared once for the landing page and the legal
 * pages rather than in the root layout, so staff pages do not download them.
 */
const manrope = Manrope({ subsets: ["latin"], variable: "--font-manrope", display: "swap" });
const plexMono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400"], variable: "--font-plex-mono", display: "swap" });
/** Eyebrows, section 6 group names and its closing line (D-050). */
const poppins = Poppins({ subsets: ["latin"], weight: ["500", "600"], variable: "--font-poppins", display: "swap" });

export const PUBLIC_FONT_CLASS = `${manrope.variable} ${plexMono.variable} ${poppins.variable}`;
export const HOLDING_FONT_CLASS = manrope.variable;
