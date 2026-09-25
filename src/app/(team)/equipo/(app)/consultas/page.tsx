import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { getStudyContext } from "@/auth/study-context";
import { NoAccess } from "@/components/team/no-access";
import { isInquiryStatus, type InquiryStatus } from "@/domain/inquiry";
import { TEAM_BASE_PATH } from "@/domain/navigation";
import { countNewInquiries, getInquiry, listInquiries } from "@/services/inquiries";
import { InquiryInbox, type InboxLabels } from "./inbox";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav");
  return { title: t("inquiries") };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Inquiries (D-088): questions people send from the public contact form before
 * applying, answered here and by email. Laid out like a chat app: the
 * conversations on the left, the open one on the right (`inbox.tsx`).
 *
 * THE TEXT IS HERE ONLY WHILE THE INQUIRY IS PENDING. Answering or closing one
 * erases the sender's name, email and message in the same transaction, and the
 * reply itself is never stored, so a health detail typed into a public box is
 * not kept. Defaults to the pending ones.
 */
export default async function InquiriesPage({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string; consulta?: string }>;
}) {
  const ctx = await getStudyContext();
  if (!ctx) return null;

  const t = await getTranslations();
  if (!ctx.permissions.has("inquiries.manage")) {
    return <NoAccess message={t("common.noAccess")} />;
  }

  const params = await searchParams;
  const filter: InquiryStatus = isInquiryStatus(params.estado) ? params.estado : "NEW";
  const wanted = params.consulta && UUID.test(params.consulta) ? params.consulta : null;

  const [rows, pendingCount, selected] = await Promise.all([
    listInquiries(ctx.study.id, { status: filter }),
    countNewInquiries(ctx.study.id),
    // Looked up on its own, not picked from the list: after answering, the open
    // conversation is no longer in the "pending" list but stays on screen.
    wanted ? getInquiry(ctx.study.id, wanted) : Promise.resolve(null),
  ]);

  const note = (key: "answeredNote" | "closedNote") => (by: string | null, when: string) =>
    t(`inquiries.${key}`, { name: by ?? t("inquiries.someone"), when });

  const labels: InboxLabels = {
    title: t("nav.inquiries"),
    subtitle: t("inquiries.subtitle"),
    tabs: {
      NEW: t("inquiries.tabs.NEW"),
      ANSWERED: t("inquiries.tabs.ANSWERED"),
      CLOSED: t("inquiries.tabs.CLOSED"),
    },
    handledTitle: { ANSWERED: t("inquiries.handledTitle.ANSWERED"), CLOSED: t("inquiries.handledTitle.CLOSED") },
    empty: t("inquiries.empty"),
    selectPrompt: t("inquiries.selectPrompt"),
    privacyNote: t("inquiries.boundary"),
    back: t("inquiries.back"),
    answeredNote: note("answeredNote"),
    closedNote: note("closedNote"),
    handledBy: t("inquiries.handledBy"),
    listAria: t("inquiries.listAria"),
    replyLabel: t("inquiries.replyLabel"),
    placeholder: t("inquiries.placeholder"),
    hint: t("inquiries.hint"),
    send: t("inquiries.send"),
    sending: t("inquiries.sending"),
    close: t("inquiries.close"),
    closeConfirm: t("inquiries.closeConfirm"),
    errors: {
      forbidden: t("inquiries.errors.forbidden"),
      invalid: t("inquiries.errors.invalid"),
      required: t("inquiries.errors.required"),
      tooLong: t("inquiries.errors.tooLong"),
      notFound: t("inquiries.errors.notFound"),
      mailNotConfigured: t("inquiries.errors.mailNotConfigured"),
      mailRejected: t("inquiries.errors.mailRejected"),
      mailFailed: t("inquiries.errors.mailFailed"),
      failed: t("inquiries.errors.failed"),
    },
  };

  return (
    <InquiryInbox
      labels={labels}
      basePath={`${TEAM_BASE_PATH}/consultas`}
      filter={filter}
      rows={rows}
      selected={selected}
      pendingCount={pendingCount}
      timeZone={ctx.study.timezone}
      now={new Date()}
    />
  );
}
