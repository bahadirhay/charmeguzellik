/**
 * Metin bloğu — Tailwind Preflight başlıkları düz metin gibi gösterir; @tailwindcss/typography yok.
 * Başlık boyutlarını açık sınıflarla veririz (önizleme + canlı site ortak).
 */
export function TextBlockView({
  content,
  as = "p",
  align = "left",
}: {
  content: string;
  as?: "p" | "h1" | "h2" | "h3";
  align?: "left" | "center" | "right";
}) {
  const alignCls = align === "center" ? "text-center" : align === "right" ? "text-right" : "text-left";
  const wrap = `mx-auto w-full max-w-3xl ${alignCls} text-inherit`;

  if (as === "h1") {
    return (
      <section className={wrap}>
        <h1 className="whitespace-pre-wrap text-3xl font-semibold tracking-tight md:text-4xl">
          {content}
        </h1>
      </section>
    );
  }
  if (as === "h2") {
    return (
      <section className={wrap}>
        <h2 className="whitespace-pre-wrap text-2xl font-semibold tracking-tight md:text-3xl">
          {content}
        </h2>
      </section>
    );
  }
  if (as === "h3") {
    return (
      <section className={wrap}>
        <h3 className="whitespace-pre-wrap text-xl font-semibold md:text-2xl">{content}</h3>
      </section>
    );
  }
  return (
    <section className={wrap}>
      <p className="whitespace-pre-wrap text-base leading-relaxed">{content}</p>
    </section>
  );
}
