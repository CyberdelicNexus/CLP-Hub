import { PageFade } from "@/components/page-fade";

/**
 * Shared frame for every public page (2026-09-29 request: a fade on
 * navigation across the whole site). None of these pages share persistent
 * chrome with each other — the landing page, /participar and the legal pages
 * each render their own header inline — so there is nothing to protect from
 * re-fading here, unlike the team app's sidebar or /estudio's back-link bar.
 */
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return <PageFade>{children}</PageFade>;
}
