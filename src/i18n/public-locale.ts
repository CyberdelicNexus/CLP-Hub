import { cookies } from "next/headers";
import { parsePublicLocale, type PublicLocale } from "@/domain/locale";
import { PUBLIC_LOCALE_COOKIE } from "./cookies";

/** The public site's language for this request: the visitor's choice, else Spanish (D-063). */
export async function getPublicLocale(): Promise<PublicLocale> {
  const store = await cookies();
  return parsePublicLocale(store.get(PUBLIC_LOCALE_COOKIE)?.value);
}
