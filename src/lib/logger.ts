import pino from "pino";

/**
 * Structured JSON logger. Redaction is defensive: never log participant
 * identity fields even if a caller passes a whole record by mistake.
 * There is no external error monitoring by design (see docs/decisions.md).
 */
const PII_PATHS = [
  "email",
  "phone",
  "firstName",
  "lastName",
  "first_name",
  "last_name",
  "address",
  "password",
  "*.email",
  "*.phone",
  "*.firstName",
  "*.lastName",
  "*.first_name",
  "*.last_name",
  "*.address",
  "*.password",
  "req.headers.authorization",
  "req.headers.cookie",
];

export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  base: { app: "clp-hub", env: process.env.APP_ENV ?? "development" },
  redact: { paths: PII_PATHS, censor: "[redacted]" },
});

export type Logger = typeof logger;
