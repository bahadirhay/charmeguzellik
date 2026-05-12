import Link from "next/link";
import { LogoutButton } from "@/components/admin/LogoutButton";
import { hasStaffPermission } from "@/lib/staff-permissions";

type NavItem = { href: string; label: string; perm: string | null; platformOnly?: boolean };

const TOP_NAV: NavItem[] = [
  { href: "/admin/dashboard", label: "Özet", perm: null },
  { href: "/admin/pages", label: "Sayfalar", perm: "content.pages" },
  { href: "/admin/navigation", label: "Menü", perm: "content.nav" },
  { href: "/admin/crm", label: "CRM", perm: "crm.leads" },
  { href: "/admin/appointments", label: "Randevular", perm: "crm.appointments" },
  { href: "/admin/commerce", label: "Ticaret", perm: "commerce.manage" },
];

const NAV_GROUPS: { title: string; items: NavItem[] }[] = [
  {
    title: "Site düzeni & tema",
    items: [
      { href: "/admin/site-regions", label: "Site düzeni", perm: "content.regions" },
      { href: "/admin/theme", label: "Tema özelleştirici", perm: "site.theme" },
    ],
  },
  {
    title: "Sosyal medya",
    items: [
      { href: "/admin/instagram", label: "Instagram", perm: "social.instagram" },
      { href: "/admin/youtube", label: "YouTube", perm: "social.youtube" },
      { href: "/admin/tiktok", label: "TikTok", perm: "social.tiktok" },
      { href: "/admin/whatsapp", label: "WhatsApp", perm: "site.settings" },
    ],
  },
  {
    title: "Ayarlar & SEO",
    items: [
      { href: "/admin/settings/modules", label: "Site modülleri", perm: "site.modules" },
      { href: "/admin/settings", label: "Genel ayarlar & SEO", perm: "site.settings" },
      { href: "/admin/settings/mobil-uygulama", label: "Mobil Randevular uygulaması", perm: "site.settings" },
      { href: "/admin/sitemap", label: "Site haritası", perm: "content.sitemap" },
      { href: "/admin/cookie-consents", label: "Çerez kayıtları", perm: "site.settings" },
      { href: "/admin/backups", label: "Yedekleme merkezi", perm: "site.settings" },
    ],
  },
  {
    title: "Kullanıcılar",
    items: [
      { href: "/admin/staff", label: "Personel & roller", perm: "users.manage" },
      { href: "/admin/appointments/personel-planlama", label: "Personel Planlama", perm: "crm.appointments" },
    ],
  },
];

const PLATFORM_NAV: NavItem[] = [
  { href: "/admin/platform/customers", label: "Müşteri siteleri", perm: "users.manage", platformOnly: true },
];

function itemVisible(
  permissions: readonly string[],
  item: NavItem,
  opts: { showPlatformNav: boolean; appointmentsModuleEnabled: boolean; commerceModuleEnabled: boolean },
): boolean {
  if (item.platformOnly && !opts.showPlatformNav) return false;
  if (
    !opts.appointmentsModuleEnabled &&
    (item.href === "/admin/appointments" || item.href === "/admin/appointments/personel-planlama")
  ) {
    return false;
  }
  if (!opts.commerceModuleEnabled && item.href === "/admin/commerce") {
    return false;
  }
  if (!item.perm) return true;
  if (item.href === "/admin/crm") {
    return hasStaffPermission(permissions, "crm.leads") || hasStaffPermission(permissions, "crm.appointments");
  }
  if (item.href === "/admin/appointments") {
    return (
      hasStaffPermission(permissions, "crm.appointments") ||
      hasStaffPermission(permissions, "crm.appointments.self")
    );
  }
  if (item.perm === "site.theme") {
    return hasStaffPermission(permissions, "site.theme") || hasStaffPermission(permissions, "site.settings");
  }
  return hasStaffPermission(permissions, item.perm);
}

function filterItems(
  permissions: readonly string[],
  items: NavItem[],
  opts: { showPlatformNav: boolean; appointmentsModuleEnabled: boolean; commerceModuleEnabled: boolean },
): NavItem[] {
  return items.filter((i) => itemVisible(permissions, i, opts));
}

function NavGroup({
  title,
  items,
  variant,
}: {
  title: string;
  items: NavItem[];
  variant: "aside" | "mobile";
}) {
  if (items.length === 0) return null;

  if (variant === "aside") {
    return (
      <details className="group rounded-lg border border-transparent open:border-zinc-200 open:bg-zinc-50 dark:open:border-zinc-800 dark:open:bg-zinc-950/60">
        <summary className="cursor-pointer list-none px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-500 marker:hidden [&::-webkit-details-marker]:hidden dark:text-zinc-400">
          {title}
        </summary>
        <div className="flex flex-col gap-0.5 pb-2 pl-1">
          {items.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="rounded-lg py-1.5 pl-4 pr-3 text-sm text-zinc-800 hover:bg-zinc-100 dark:text-zinc-100 dark:hover:bg-zinc-800"
            >
              {l.label}
            </Link>
          ))}
        </div>
      </details>
    );
  }

  return (
    <details className="w-full rounded border border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900/50">
      <summary className="cursor-pointer list-none px-2 py-1.5 text-[10px] font-semibold uppercase text-zinc-500 marker:hidden [&::-webkit-details-marker]:hidden dark:text-zinc-400">
        {title}
      </summary>
      <div className="flex flex-col gap-1 border-t border-zinc-200 px-2 py-2 dark:border-zinc-700">
        {items.map((l) => (
          <Link key={l.href} href={l.href} className="text-[11px] text-rose-600">
            {l.label}
          </Link>
        ))}
      </div>
    </details>
  );
}

export function AdminShell({
  children,
  username,
  roleSlug,
  isLegacy,
  permissions,
  showPlatformNav = false,
  appointmentsModuleEnabled = true,
  commerceModuleEnabled = true,
}: {
  children: React.ReactNode;
  username: string;
  roleSlug: string | null;
  isLegacy: boolean;
  permissions: readonly string[];
  /** Yalnızca PLATFORM_CONTROL_TENANT_ID kiracısında doğru layout’ta true */
  showPlatformNav?: boolean;
  /** Tenant.featuresJson: randevu modülü kapalıysa false */
  appointmentsModuleEnabled?: boolean;
  /** Tenant.featuresJson: ticaret modülü kapalıysa false */
  commerceModuleEnabled?: boolean;
}) {
  const navOpts = { showPlatformNav, appointmentsModuleEnabled, commerceModuleEnabled };
  const top = filterItems(permissions, TOP_NAV, navOpts);
  const baseGroups = NAV_GROUPS.map((g) => ({
    title: g.title,
    items: filterItems(permissions, g.items, navOpts),
  })).filter((g) => g.items.length > 0);
  const platformItems = filterItems(permissions, PLATFORM_NAV, navOpts);
  const groups =
    platformItems.length > 0 ? [...baseGroups, { title: "Platform", items: platformItems }] : baseGroups;

  const roleLine = isLegacy
    ? "Tam yetki (ortam girişi)"
    : roleSlug
      ? roleSlug.includes(",")
        ? `Roller: ${roleSlug}`
        : `Rol: ${roleSlug}`
      : "Panel";

  return (
    <div className="flex min-h-screen min-w-0 overflow-x-hidden bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50">
      <aside className="hidden w-60 shrink-0 border-r border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 md:block">
        <div className="p-4 text-sm font-semibold text-rose-600 dark:text-rose-400">Yönetim</div>
        <nav className="flex flex-col gap-1 px-2 pb-4">
          {top.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="rounded-lg px-3 py-2 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              {l.label}
            </Link>
          ))}
          <div className="my-1 border-t border-zinc-100 dark:border-zinc-800" />
          {groups.map((g) => (
            <NavGroup key={g.title} title={g.title} items={g.items} variant="aside" />
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
      <div className="flex min-h-screen min-w-0 flex-1 flex-col overflow-x-hidden">
        <header className="max-h-[50vh] overflow-y-auto border-b border-zinc-200 bg-white px-3 py-3 dark:border-zinc-800 dark:bg-zinc-900 md:hidden">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="text-sm font-medium">Admin</span>
          </div>
          <div className="flex flex-col gap-2">
            {top.map((l) => (
              <Link key={l.href} href={l.href} className="text-xs text-rose-600">
                {l.label}
              </Link>
            ))}
            {groups.map((g) => (
              <NavGroup key={g.title} title={g.title} items={g.items} variant="mobile" />
            ))}
          </div>
        </header>
        <div className="min-w-0 flex-1 p-4 md:p-8">{children}</div>
      </div>
    </div>
  );
}
