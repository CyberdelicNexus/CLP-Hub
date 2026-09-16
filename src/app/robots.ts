import type { MetadataRoute } from "next";

/**
 * Nothing here is for a search engine.
 *
 * The root layout already sends `robots: noindex, nofollow` on every page, but
 * a deployment on a real domain is reachable by anyone who has the link, and
 * the recruitment copy is unapproved (docs/landing-page.md): a crawler should
 * not be fetching it at all. This is the second half of that, and it is safe
 * to disallow crawling outright precisely because nothing is indexed yet — a
 * page that were already in an index would need the meta tag to stay
 * crawlable long enough to be seen.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", disallow: "/" },
  };
}
