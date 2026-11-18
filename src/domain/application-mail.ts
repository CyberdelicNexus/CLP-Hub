/**
 * The staff notice for a new application (D-152), as pure text so it can be
 * tested. Like the consulta notice, it names nobody: the applicant's name,
 * email and phone are read in the Hub only, never in a mailbox.
 */

/** At most this many application notices per study per hour; the Hub still shows them all. */
export const APPLICATION_NOTIFY_PER_HOUR = 5;

export function applicationStaffNotification(params: { count: number; listUrl: string | null }): {
  subject: string;
  text: string;
} {
  const { count, listUrl } = params;
  const lines = [
    count <= 1
      ? "Ha llegado una solicitud nueva a Clear Light desde la web."
      : `Ha llegado una solicitud nueva a Clear Light. Hay ${count} solicitudes pendientes de revisar.`,
    "",
    listUrl ? `Revísala en el Hub: ${listUrl}` : "Revísala en el Hub, en Solicitudes.",
    "",
    "Este aviso no incluye los datos de la persona a propósito: se consultan solo en el Hub.",
  ];
  return { subject: "Nueva solicitud en el Hub de Clear Light", text: lines.join("\n") };
}
