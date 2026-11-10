/**
 * One-off: the digital consent of people already in the Hub (2026-10-30,
 * D-139). From now on the Hub records it by itself; this catches up the
 * participants who passed those moments before it did, through the same
 * `ensureDigitalConsent`, so each row carries its audit row attributed to
 * --actor.
 *
 *   npx tsx --conditions=react-server scripts/backfill-digital-consent.ts --study=CLP --actor=<staff email> [--dry-run]
 *
 * Who counts: anyone with a Qualtrics response on record, an application past
 * "submitted", or an allocation. Someone who only left their name is skipped,
 * and a consent that was withdrawn or declined is left exactly as it is.
 */
import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local" });
loadEnv();

function arg(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.find((a) => a.startsWith(prefix))?.slice(prefix.length);
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const studyCode = arg("study");
  const actorEmail = arg("actor");
  if (!studyCode || !actorEmail) throw new Error("Pass --study=<code> --actor=<email of the staff member>.");

  const { eq, sql } = await import("drizzle-orm");
  const { getDb } = await import("@/db/client");
  const schema = await import("@/db/schema");
  const { ensureDigitalConsent } = await import("@/services/participant-ops");

  const db = getDb();
  const [study] = await db
    .select({ id: schema.studies.id })
    .from(schema.studies)
    .where(eq(schema.studies.code, studyCode))
    .limit(1);
  if (!study) throw new Error(`Study ${studyCode} not found.`);
  const [actor] = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.email, actorEmail))
    .limit(1);
  if (!actor) throw new Error(`No staff user with email ${actorEmail}.`);

  const rows = await db
    .select({
      id: schema.participants.id,
      code: schema.participants.code,
      enrollmentStatus: schema.participants.enrollmentStatus,
    })
    .from(schema.participants)
    .where(
      sql`${schema.participants.studyId} = ${study.id} and (
        exists (select 1 from randomizations r where r.participant_id = ${schema.participants.id})
        or exists (
          select 1 from applications a
          where a.participant_id = ${schema.participants.id}
            and (a.source = 'QUALTRICS' or a.status <> 'SUBMITTED')
        )
      ) and (
        not exists (
          select 1 from consents c
          where c.participant_id = ${schema.participants.id} and c.consent_type = 'DIGITAL'
        )
        or exists (
          select 1 from consents c
          where c.participant_id = ${schema.participants.id} and c.consent_type = 'DIGITAL' and c.status = 'PENDING'
        )
      )`,
    );

  for (const p of rows) {
    console.log(`${p.code}  ${p.enrollmentStatus ?? "(none)"}`);
    if (dryRun) continue;
    await db.transaction(async (tx) => {
      await ensureDigitalConsent(tx, {
        studyId: study.id,
        participantId: p.id,
        participantCode: p.code,
        enrollmentStatus: p.enrollmentStatus,
        actorId: actor.id,
      });
    });
  }

  console.log(`\n${rows.length} participant(s)${dryRun ? ". Dry run: nothing written." : " recorded."}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
