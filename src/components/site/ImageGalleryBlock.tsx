import type { PageBlock } from "@/lib/blocks/schema";
import { normalizePublicMediaUrl } from "@/lib/media-url";

type GalleryProps = Extract<PageBlock, { type: "imageGallery" }>["props"];

const gapClass = { sm: "gap-2", md: "gap-3", lg: "gap-5" } as const;
const colsClass = {
  2: "grid-cols-1 sm:grid-cols-2",
  3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
  4: "grid-cols-2 sm:grid-cols-2 lg:grid-cols-4",
} as const;

function imageClassName(imageAspect: GalleryProps["imageAspect"]): string {
  if (imageAspect === "square") return "aspect-square h-full w-full object-cover";
  if (imageAspect === "auto") return "h-auto w-full max-h-[min(70vh,480px)] object-contain";
  return "aspect-video h-full w-full object-cover";
}

export function ImageGalleryBlock({ props }: { props: GalleryProps }) {
  const cols = props.columns ?? 3;
  const gap = gapClass[props.gap ?? "md"];
  const grid = colsClass[cols];
  const rounded = props.rounded !== false;
  const imgShape = imageClassName(props.imageAspect ?? "video");
  const valid = props.images
    .map((im) => ({ ...im, src: normalizePublicMediaUrl(im.src) }))
    .filter((im) => im.src?.trim());
  if (valid.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-zinc-300 px-4 py-6 text-center text-sm text-zinc-500 dark:border-zinc-600">
        Galeride henüz görsel URL’si yok.
      </p>
    );
  }

  return (
    <section className="w-full space-y-3">
      {props.title ? (
        <h2 className="text-center text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 md:text-xl">
          {props.title}
        </h2>
      ) : null}
      <div className={`grid ${grid} ${gap}`}>
        {valid.map((im) => {
          const inner = (
            <div
              className={`overflow-hidden border border-zinc-200/80 bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 ${
                rounded ? "rounded-xl" : ""
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={im.src} alt={im.alt ?? ""} className={imgShape} />
            </div>
          );
          const href = im.href?.trim();
          const external = href ? /^https?:\/\//i.test(href) : false;
          return (
            <figure key={im.id} className="min-w-0">
              {href ? (
                <a
                  href={href}
                  {...(external ? ({ target: "_blank", rel: "noopener noreferrer" } as const) : {})}
                  className="block transition hover:opacity-95"
                >
                  {inner}
                </a>
              ) : (
                inner
              )}
              {im.alt ? (
                <figcaption className="mt-1.5 text-center text-xs text-zinc-500 dark:text-zinc-400">{im.alt}</figcaption>
              ) : null}
            </figure>
          );
        })}
      </div>
    </section>
  );
}
