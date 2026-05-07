"use client";

import { AdminWhatsAppButton } from "@/components/admin/AdminWhatsAppButton";
import type { Lead } from "@prisma/client";
import { useState } from "react";

export function LeadRow({ lead }: { lead: Lead }) {
  const [status, setStatus] = useState(lead.status);
  const [notes, setNotes] = useState(lead.notes ?? "");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    await fetch(`/api/admin/leads/${lead.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, notes }),
    });
    setSaving(false);
  }

  return (
    <tr className="border-b border-zinc-100 dark:border-zinc-800">
      <td className="whitespace-nowrap px-3 py-2 text-xs text-zinc-500">
        {new Date(lead.createdAt).toLocaleString("tr-TR")}
      </td>
      <td className="px-3 py-2 font-medium">{lead.name}</td>
      <td className="px-3 py-2 text-xs">
        <div>{lead.email}</div>
        <div className="flex flex-wrap items-center gap-2">
          <span>{lead.phone ?? "—"}</span>
          <AdminWhatsAppButton
            phone={lead.phone}
            prefilledMessage={`Merhaba ${lead.name.trim() || "Merhaba"}, iletişim formunuz hakkında yazıyorum.`}
            className="inline-flex shrink-0 items-center rounded-full border border-emerald-600/50 bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-900 hover:bg-emerald-100 dark:border-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-100"
          />
        </div>
        <div className="text-zinc-500">{lead.message}</div>
      </td>
      <td className="px-3 py-2">
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded border border-zinc-300 bg-white text-xs dark:border-zinc-600 dark:bg-zinc-950"
        >
          <option value="new">Yeni</option>
          <option value="contacted">Görüşüldü</option>
          <option value="won">Kazanıldı</option>
          <option value="lost">Kayıp</option>
        </select>
      </td>
      <td className="px-3 py-2">
        <textarea
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="w-40 rounded border border-zinc-300 bg-white text-xs dark:border-zinc-600 dark:bg-zinc-950"
        />
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="ml-2 rounded bg-zinc-200 px-2 py-1 text-xs dark:bg-zinc-800"
        >
          Kaydet
        </button>
      </td>
    </tr>
  );
}
