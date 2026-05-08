import { AdminWhatsAppButton } from "@/components/admin/AdminWhatsAppButton";
import { LeadRow } from "@/components/admin/LeadRow";
import { CrmContactRowActions } from "@/components/admin/CrmContactRowActions";
import { parseAssignedStaffFromNotes } from "@/lib/appointment-staffing";
import { requirePagePermission } from "@/lib/auth";
import { hasStaffPermission } from "@/lib/staff-permissions";
import { prisma } from "@/lib/prisma";
import { BOOTSTRAP_TENANT_ID } from "@/lib/tenant-db";

export default async function CrmPage() {
  const access = await requirePagePermission(["crm.leads", "crm.appointments"]);
  const showLeads = hasStaffPermission(access.permissions, "crm.leads");
  const showContacts = hasStaffPermission(access.permissions, "crm.appointments");

  const [leads, contacts] = await Promise.all([
    showLeads
      ? prisma.lead.findMany({
          where: { tenantId: BOOTSTRAP_TENANT_ID },
          orderBy: { createdAt: "desc" },
        })
      : Promise.resolve([]),
    showContacts
      ? prisma.crmContact.findMany({
          where: { tenantId: BOOTSTRAP_TENANT_ID },
          orderBy: { updatedAt: "desc" },
          include: {
            appointments: {
              where: { status: { in: ["pending", "approved", "confirmed"] } },
              orderBy: { startAt: "desc" },
              take: 8,
              select: {
                id: true,
                startAt: true,
                serviceName: true,
                status: true,
                notes: true,
              },
            },
          },
        })
      : Promise.resolve([]),
  ]);

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-semibold">CRM</h1>
        <p className="text-sm text-zinc-500">
          İletişim formu talepleri ve randevu müşteri kartları (telefonla eşleşen kayıtlar).
        </p>
      </div>

      {showContacts ? (
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-medium">Randevu müşterileri</h2>
            <p className="text-xs text-zinc-500">
              Site üzerinden telefonu girilen taleplerde otomatik oluşur; aynı numara tekrar girildiğinde ad ve e-posta
              önerilir.
            </p>
          </div>
          <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950">
                <tr>
                  <th className="px-3 py-2">Güncelleme</th>
                  <th className="px-3 py-2">Ad</th>
                  <th className="px-3 py-2">Telefon (anahtar)</th>
                  <th className="px-3 py-2">E-posta</th>
                  <th className="px-3 py-2">Son randevular</th>
                  <th className="px-3 py-2">İşlem</th>
                </tr>
              </thead>
              <tbody>
                {contacts.map((c) => (
                  <tr key={c.id} className="border-b border-zinc-100 dark:border-zinc-800">
                    <td className="whitespace-nowrap px-3 py-2 text-xs text-zinc-500">
                      {new Date(c.updatedAt).toLocaleString("tr-TR")}
                    </td>
                    <td className="px-3 py-2 font-medium">{c.name}</td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
                        <span>{c.phoneKey}</span>
                        <AdminWhatsAppButton
                          phone={c.phoneKey}
                          prefilledMessage={`Merhaba ${c.name.trim() || "Merhaba"}, randevunuz / iletişiminiz hakkında yazıyorum.`}
                          label="WhatsApp"
                        />
                      </div>
                    </td>
                    <td className="px-3 py-2 text-xs">{c.email ?? "—"}</td>
                    <td className="px-3 py-2 text-xs">
                      {c.appointments.length === 0 ? (
                        <span className="text-zinc-400">—</span>
                      ) : (
                        <ul className="max-w-xs list-inside list-disc space-y-0.5">
                          {c.appointments.map((a) => {
                            const staffLabel = parseAssignedStaffFromNotes(a.notes)?.trim();
                            return (
                              <li key={a.id}>
                                {new Date(a.startAt).toLocaleString("tr-TR")}
                                {a.serviceName ? ` · ${a.serviceName}` : ""}
                                {staffLabel ? ` · Personel: ${staffLabel}` : ""}
                                <span className="text-zinc-500">
                                  {" "}
                                  ({a.status === "pending" ? "bekliyor" : a.status === "confirmed" ? "teyitli" : "onaylı"})
                                </span>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </td>
                    <td className="px-3 py-2 align-top">
                      <CrmContactRowActions id={c.id} name={c.name} email={c.email} phoneKey={c.phoneKey} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {contacts.length === 0 ? (
              <p className="p-6 text-center text-sm text-zinc-500">
                Henüz telefonlu randevu kaydı yok; ilk talep geldiğinde burada görünür.
              </p>
            ) : null}
          </div>
        </div>
      ) : null}

      {showLeads ? (
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-medium">İletişim formu talepleri</h2>
            <p className="text-xs text-zinc-500">Form ve kaynaklardan gelen kişiler.</p>
          </div>
          <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950">
                <tr>
                  <th className="px-3 py-2">Tarih</th>
                  <th className="px-3 py-2">Ad</th>
                  <th className="px-3 py-2">İletişim</th>
                  <th className="px-3 py-2">Durum</th>
                  <th className="px-3 py-2">Not</th>
                </tr>
              </thead>
              <tbody>
                {leads.map((l) => (
                  <LeadRow key={l.id} lead={l} />
                ))}
              </tbody>
            </table>
            {leads.length === 0 ? (
              <p className="p-6 text-center text-sm text-zinc-500">Henüz kayıt yok.</p>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
