import Link from "next/link";
import { AdminDeletePageButton } from "@/components/admin/AdminDeletePageButton";
import { requirePagePermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { BOOTSTRAP_TENANT_ID } from "@/lib/tenant-db";

export default async function AdminPagesPage() {
  await requirePagePermission("content.pages");
  const pages = await prisma.page.findMany({
    where: { tenantId: BOOTSTRAP_TENANT_ID },
    orderBy: { updatedAt: "desc" },
  });
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Sayfalar</h1>
          <p className="mt-1 text-xs text-zinc-500">
            Ana sayfa: <strong className="text-zinc-700 dark:text-zinc-300">slug = home</strong> olan satır →{" "}
            <strong>Blok düzenleyici</strong> (yeni blok için sol <strong>Widget&apos;lar</strong>, sonra{" "}
            <strong>Kaydet</strong>). Tüm sayfalarda tekrarlayan üst/alt alanlar için{" "}
            <Link href="/admin/site-regions" className="font-medium text-rose-600 hover:underline">
              Site düzeni
            </Link>
            .
          </p>
        </div>
        <Link
          href="/admin/pages/new"
          className="rounded-full bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700"
        >
          + Yeni sayfa
        </Link>
      </div>
      <ul className="divide-y divide-zinc-200 rounded-xl border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
        {pages.map((p) => (
          <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
            <div>
              <p className="font-medium">{p.title}</p>
              <p className="text-xs text-zinc-500">
                /{p.slug === "home" ? "" : p.slug} · {p.published ? "yayında" : "taslak"}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href={`/admin/pages/${p.id}/edit`}
                className="rounded-full bg-zinc-900 px-3 py-1 text-sm text-white dark:bg-zinc-100 dark:text-zinc-900"
              >
                Blok düzenleyici
              </Link>
              <AdminDeletePageButton pageId={p.id} slug={p.slug} title={p.title} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
