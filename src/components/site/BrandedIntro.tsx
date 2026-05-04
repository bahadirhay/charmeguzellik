import type { ReactNode } from "react";

type Props = {
  title: string;
  body: string;
  accentPhrase?: string;
  align?: "left" | "center";
};

function bodyWithAccent(body: string, phrase?: string): ReactNode {
  if (!phrase) return body;
  const ix = body.indexOf(phrase);
  if (ix < 0) return body;
  return (
    <>
      {body.slice(0, ix)}
      <strong className="font-semibold text-[var(--site-brand,#b84d5c)]">{phrase}</strong>
      {body.slice(ix + phrase.length)}
    </>
  );
}

export function BrandedIntro({ title, body, accentPhrase, align = "left" }: Props) {
  const alignCls = align === "center" ? "text-center" : "text-left";
  return (
    <section className={`site-branded-intro mx-auto w-full max-w-3xl space-y-4 ${alignCls}`}>
      <h2 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 md:text-4xl">
        {title}
      </h2>
      <p className="text-base leading-relaxed text-zinc-600 dark:text-zinc-400 md:text-lg">
        {bodyWithAccent(body, accentPhrase)}
      </p>
    </section>
  );
}
