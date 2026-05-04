import Link from "next/link";
import { NewPageForm } from "@/components/admin/NewPageForm";
import { requirePagePermission } from "@/lib/auth";

export default async function NewPagePage() {
  await requirePagePermission("content.pages");
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-4">
        <Link href="/admin/pages" className="text-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200">
          ← Sayfalar
        </Link>
        <h1 className="text-2xl font-semibold">Yeni sayfa</h1>
      </div>
      <NewPageForm />
    </div>
  );
}
