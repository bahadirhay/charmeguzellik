import type { NavItem } from "@prisma/client";

/** İstemci bileşenlerinde kullanın — `@/lib/navigation` Prisma içerir. */
export type NavNode = {
  id: string;
  label: string;
  href: string;
  openInNewTab: boolean;
  children: NavNode[];
};

export function normalizeNavHref(href: string): string {
  const t = href.trim();
  if (!t) return "#";
  if (
    t.startsWith("http://") ||
    t.startsWith("https://") ||
    t.startsWith("mailto:") ||
    t.startsWith("tel:") ||
    t.startsWith("#")
  ) {
    return t;
  }
  if (t === "home") return "/";
  if (t.startsWith("/")) return t;
  return `/${t}`;
}

export function buildNavTree(items: NavItem[]): NavNode[] {
  const byParent = new Map<string | null, NavItem[]>();
  for (const it of items) {
    const k = it.parentId ?? null;
    if (!byParent.has(k)) byParent.set(k, []);
    byParent.get(k)!.push(it);
  }
  for (const list of byParent.values()) {
    list.sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label));
  }
  function toNode(item: NavItem): NavNode {
    const kids = byParent.get(item.id) ?? [];
    return {
      id: item.id,
      label: item.label,
      href: normalizeNavHref(item.href),
      openInNewTab: item.openInNewTab,
      children: kids.map(toNode),
    };
  }
  const roots = byParent.get(null) ?? [];
  return roots.map(toNode);
}

/** Randevu formu: üst menüde "Hizmetlerimiz" (TR büyük/küçük harf) adlı ve alt linkleri olan ilk öğe */
export function findNavParentForServicesMenu(nodes: NavNode[]): NavNode | null {
  const norm = (s: string) => s.replace(/\s+/g, " ").trim().toLocaleLowerCase("tr-TR");
  const target = norm("Hizmetlerimiz");
  function walk(list: NavNode[]): NavNode | null {
    for (const n of list) {
      if (n.children.length > 0 && norm(n.label) === target) return n;
      const inner = walk(n.children);
      if (inner) return inner;
    }
    return null;
  }
  return walk(nodes);
}

/** Üst menüde «Hizmetlerimiz» altındaki yayınlı hizmet başlıkları (randevu formları ile aynı kaynak) */
export function collectServiceLabelsFromNav(nodes: NavNode[]): string[] {
  const parent = findNavParentForServicesMenu(nodes);
  if (!parent) return [];
  return parent.children.map((c) => c.label.trim()).filter(Boolean);
}
