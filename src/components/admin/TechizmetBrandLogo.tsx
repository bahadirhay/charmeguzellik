import Link from "next/link";

const LOGO_SRC = "/brand/techizmet-logo.png";
const LOGO_ALT = "Techizmet IT Solutions";

type Variant = "login" | "sidebar" | "header";

const variantClass: Record<Variant, string> = {
  login: "max-h-[7.5rem] w-auto max-w-[min(100%,16rem)]",
  sidebar: "max-h-14 w-auto max-w-[min(100%,11rem)]",
  header: "max-h-9 w-auto max-w-[10rem]",
};

export function TechizmetBrandLogo({
  variant = "sidebar",
  href,
  className = "",
}: {
  variant?: Variant;
  /** Verilirse logo tıklanabilir (ör. panele dönüş). */
  href?: string;
  className?: string;
}) {
  const img = (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={LOGO_SRC}
      alt={LOGO_ALT}
      width={220}
      height={120}
      className={`h-auto object-contain object-left ${variantClass[variant]} ${className}`.trim()}
    />
  );

  if (href) {
    return (
      <Link href={href} className="inline-flex shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40 rounded-md">
        {img}
      </Link>
    );
  }

  return <div className="inline-flex shrink-0">{img}</div>;
}
