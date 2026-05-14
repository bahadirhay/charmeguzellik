"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";

/** `/admin/appointments?appt=<id>` ile tablo satırına (`data-admin-appt-id`) kaydırır. */
export function AdminAppointmentFocusFromQuery() {
  const searchParams = useSearchParams();

  useEffect(() => {
    const raw = searchParams.get("appt")?.trim();
    if (!raw) return;
    const id = raw.replace(/[^a-zA-Z0-9_-]/g, "");
    if (!id) return;

    let timer: number | undefined;
    let poll: number | undefined;
    let cleaned = false;
    let focused = false;

    const apply = (el: HTMLElement) => {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("ring-2", "ring-rose-500", "ring-offset-2", "dark:ring-offset-zinc-900");
      timer = window.setTimeout(() => {
        el.classList.remove("ring-2", "ring-rose-500", "ring-offset-2", "dark:ring-offset-zinc-900");
      }, 4500);
    };

    const tryOnce = () => {
      if (focused || cleaned) return;
      const el = document.querySelector<HTMLElement>(`[data-admin-appt-id="${id}"]`);
      if (el) {
        focused = true;
        if (poll) window.clearInterval(poll);
        poll = undefined;
        apply(el);
      }
    };

    tryOnce();
    if (!document.querySelector(`[data-admin-appt-id="${id}"]`)) {
      let n = 0;
      poll = window.setInterval(() => {
        if (cleaned || n++ > 40) {
          if (poll) window.clearInterval(poll);
          poll = undefined;
          return;
        }
        tryOnce();
      }, 100);
    }

    return () => {
      cleaned = true;
      if (poll) window.clearInterval(poll);
      if (timer) window.clearTimeout(timer);
    };
  }, [searchParams]);

  return null;
}
