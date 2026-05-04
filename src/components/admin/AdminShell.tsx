import Link from "next/link";
import { LogoutButton } from "@/components/admin/LogoutButton";
import { hasStaffPermission } from "@/lib/staff-permissions";

const NAV_LINKS: { href: string; label: string; perm: string | null }[] = [
  { href: "/admin/dashboard", label: "Özet", perm: null },
  { href: "/admin/pages", label: "Sayfalar", perm: "content.pages" },
  { href: "/admin/site-regions", label: "Site düzeni", perm: "content.regions" },
  { href: "/admin/theme", label: "Tema özelleştirici", perm: "site.theme" },
  { href: "/admin/navigation", label: "Menü", perm: "content.nav" },
  { href: "/admin/sitemap", label: "Site haritası", perm: "content.sitemap" },
  { href: "/admin/instagram", label: "Instagram", perm: "social.instagram" },
  { href: "/admin/youtube", label: "YouTube", perm: "social.youtube" },
  { href: "/admin/tiktok", label: "TikTok", perm: "social.tiktok" },
  { href: "/admin/crm", label: "CRM", perm: "crm.leads" },
  { href: "/admin/appointments", label: "Randevular", perm: "crm.appointments" },
  { href: "/admin/whatsapp", label: "WhatsApp", perm: "site.settings" },
  { href: "/admin/settings", label: "Ayarlar & SEO", perm: "site.settings" },
  { href: "/admin/staff", label: "Personel & roller", perm: "users.manage" },
];

export function AdminShell({
  children,
  username,
  roleSlug,
  isLegacy,
  permissions,
}: {
  children: React.ReactNode;
  username: string;
  roleSlug: string | null;
  isLegacy: boolean;
  permissions: readonly string[];
}) {
  const visible = NAV_LINKS.filter((l) => {
    if (!l.perm) return true;
    if (l.href === "/admin/crm") {
      return (
        hasStaffPermission(permissions, "crm.leads") || hasStaffPermission(permissions, "crm.appointments")
      );
    }
    if (l.perm === "site.theme") {
      return hasStaffPermission(permissions, "site.theme") || hasStaffPermission(permissions, "site.settings");
    }
    return hasStaffPermission(permissions, l.perm);
  });

  const roleLine = isLegacy ? "Tam yetki (ortam girişi)" : roleSlug ? `Rol: ${roleSlug}` : "Panel";

  return (
    <div className="flex min-h-screen bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50">
      <aside className="hidden w-56 shrink-0 border-r border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 md:block">
        <div className="p-4 text-sm font-semibold text-rose-600 dark:text-rose-400">Yönetim</div>
        <nav className="flex flex-col gap-1 px-2 pb-4">
          {visible.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="rounded-lg px-3 py-2 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="border-t border-zinc-200 px-3 py-2 text-[10px] text-zinc-500 dark:border-zinc-800">
          <p className="truncate font-medium text-zinc-700 dark:text-zinc-300">{username}</p>
          <p className="truncate">{roleLine}</p>
        </div>
        <div className="px-2 pb-4">
          <LogoutButton />
        </div>
      </aside>
      <div className="flex min-h-screen flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900 md:hidden">
          <span className="text-sm font-medium">Admin</span>
          <nav className="flex max-w-[65%] flex-wrap justify-end gap-2 text-xs">
            {visible.map((l) => (
              <Link key={l.href} href={l.href} className="text-rose-600">
                {l.label}
              </Link>
            ))}
          </nav>
        </header>
        <div className="flex-1 p-4 md:p-8">{children}</div>
      </div>
    </div>
  );
}
