import Link from "next/link";
import type { NavNode } from "@/lib/navigation";

function linkProps(openInNewTab: boolean) {
  return openInNewTab ? { target: "_blank" as const, rel: "noopener noreferrer" as const } : {};
}

export type SiteMenuVariant = "links" | "stacked";

/** Admin’de tanımlı menü ağacını (header veya footer) sitede listeler */
export function PublicSiteMenu({
  nodes,
  variant = "links",
  className = "",
}: {
  nodes: NavNode[];
  variant?: SiteMenuVariant;
  className?: string;
}) {
  if (!nodes.length) {
    return (
      <p className="rounded-lg border border-dashed border-zinc-300 px-3 py-2 text-sm text-zinc-500 dark:border-zinc-600">
        Bu menüde henüz yayınlanmış öğe yok. <strong>Admin → Menü</strong> üzerinden ekleyin.
      </p>
    );
  }

  if (variant === "stacked") {
    return (
      <nav aria-label="Site menüsü" className={`space-y-1 ${className}`}>
        <ul className="space-y-1">
          {nodes.map((n) => (
            <li key={n.id}>
              <MenuBranch node={n} depth={0} stacked />
            </li>
          ))}
        </ul>
      </nav>
    );
  }

  return (
    <nav aria-label="Site menüsü" className={className}>
      <ul className="flex flex-wrap items-center gap-x-1 gap-y-1">
        {nodes.map((n) => (
          <li key={n.id} className="relative">
            <TopItem node={n} />
          </li>
        ))}
      </ul>
    </nav>
  );
}

function TopItem({ node }: { node: NavNode }) {
  const has = node.children.length > 0;
  if (!has) {
    return (
      <Link
        href={node.href}
        {...linkProps(node.openInNewTab)}
        className="inline-flex items-center rounded-md px-2.5 py-1.5 text-sm font-medium text-[var(--site-fg)] hover:bg-[var(--site-nav-hover)]"
      >
        {node.label}
      </Link>
    );
  }
  return (
    <details className="group relative">
      <summary className="inline-flex cursor-pointer list-none items-center gap-1 rounded-md px-2.5 py-1.5 text-sm font-medium text-[var(--site-fg)] hover:bg-[var(--site-nav-hover)] [&::-webkit-details-marker]:hidden">
        {node.label}
        <span className="text-[10px] text-[var(--site-muted)] group-open:rotate-180">▼</span>
      </summary>
      <ul className="absolute left-0 z-50 mt-1 min-w-[12rem] rounded-lg border border-black/10 bg-[var(--site-header-bg)] py-1 shadow-lg backdrop-blur-md">
        {node.children.map((c) => (
          <li key={c.id}>
            <Link
              href={c.href}
              {...linkProps(c.openInNewTab)}
              className="block px-3 py-2 text-sm text-[var(--site-fg)] hover:bg-[var(--site-nav-hover)]"
            >
              {c.label}
            </Link>
          </li>
        ))}
      </ul>
    </details>
  );
}

function MenuBranch({ node, depth, stacked }: { node: NavNode; depth: number; stacked?: boolean }) {
  const has = node.children.length > 0;
  if (!has) {
    return (
      <Link
        href={node.href}
        {...linkProps(node.openInNewTab)}
        className="block rounded-md py-1 text-sm text-[var(--site-fg)] hover:underline"
        style={{ paddingLeft: stacked ? depth * 12 : undefined }}
      >
        {node.label}
      </Link>
    );
  }
  return (
    <div className="space-y-1" style={{ paddingLeft: stacked ? depth * 8 : 0 }}>
      <span className="block text-sm font-semibold text-[var(--site-fg)]">{node.label}</span>
      <ul className="space-y-1 border-l border-black/10 pl-3 dark:border-white/10">
        {node.children.map((c) => (
          <li key={c.id}>
            <MenuBranch node={c} depth={depth + 1} stacked={stacked} />
          </li>
        ))}
      </ul>
    </div>
  );
}
