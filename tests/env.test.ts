import { describe, expect, it } from "vitest";
import { isDemoDataAllowed, scriptEnvSchema } from "@/config/env-schema";
import { DEFAULT_LOCALE, parseLocale } from "@/domain/locale";

describe("demo data guard", () => {
  it("allows seeding only with explicit opt-in outside production", () => {
    expect(isDemoDataAllowed({ APP_ENV: "development", ALLOW_DEMO_DATA: "true" })).toBe(true);
    expect(isDemoDataAllowed({ APP_ENV: "staging", ALLOW_DEMO_DATA: "true" })).toBe(true);
    expect(isDemoDataAllowed({ APP_ENV: "development", ALLOW_DEMO_DATA: "false" })).toBe(false);
    expect(isDemoDataAllowed({ APP_ENV: "development" })).toBe(false);
    expect(isDemoDataAllowed({ APP_ENV: "production", ALLOW_DEMO_DATA: "true" })).toBe(false);
  });

  it("script env requires the service role key and a strong-enough seed password", () => {
    const base = {
      NEXT_PUBLIC_SUPABASE_URL: "https://x.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "k",
      DATABASE_URL: "postgresql://u:p@h/db",
      SEED_STAFF_PASSWORD: "long-enough",
    };
    expect(scriptEnvSchema.safeParse(base).success).toBe(true);
    expect(scriptEnvSchema.safeParse({ ...base, SEED_STAFF_PASSWORD: "short" }).success).toBe(false);
    expect(scriptEnvSchema.safeParse({ ...base, SUPABASE_SERVICE_ROLE_KEY: "" }).success).toBe(false);
  });
});

describe("locale parsing", () => {
  it("defaults to Spanish for unknown values", () => {
    expect(DEFAULT_LOCALE).toBe("es");
    expect(parseLocale(undefined)).toBe("es");
    expect(parseLocale("fr")).toBe("es");
    expect(parseLocale("en")).toBe("en");
  });
});
