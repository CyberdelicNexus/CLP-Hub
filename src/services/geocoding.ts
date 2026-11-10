import "server-only";
import { parsePlaces, type Place } from "@/domain/logistics";
import { logger } from "@/lib/logger";

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const TIMEOUT_MS = 6_000;

/**
 * Find a place on the map from what staff typed for a headset's location (D-145).
 *
 * Runs on the server, so OpenStreetMap's Nominatim sees this application rather
 * than the staff member's IP. It is sent that text and nothing else: no
 * participant, code or study. The text is never logged here, since it can be an
 * address. Nominatim's terms ask for at most one request a second and no
 * search-as-you-type, which is why this runs on a button.
 */
export async function searchPlaces(query: string): Promise<Place[] | null> {
  const url = new URL(NOMINATIM_URL);
  url.search = new URLSearchParams({ format: "jsonv2", limit: "5", "accept-language": "es", q: query }).toString();

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "CLP-Hub/1.0 (research study operations)" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
    if (!res.ok) {
      logger.warn({ event: "geocoding.refused", status: res.status }, "place search refused");
      return null;
    }
    return parsePlaces(await res.json());
  } catch (err) {
    logger.warn({ event: "geocoding.failed", err: err instanceof Error ? err.name : "unknown" }, "place search failed");
    return null;
  }
}
