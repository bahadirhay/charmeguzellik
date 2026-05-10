"use client";

export default function AdminShellError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto max-w-lg rounded-xl border border-zinc-200 bg-white p-6 text-center dark:border-zinc-800 dark:bg-zinc-950">
      <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Yönetim paneli bu sayfayı yüklerken hata oluştu.</p>
      <p className="mt-2 text-xs text-zinc-500">Geçici bir veritabanı veya oturum sorunu olabilir; tekrar deneyin veya çıkış yapıp yeniden giriş yapın.</p>
      <button
        type="button"
        className="mt-6 rounded-full bg-zinc-900 px-4 py-2 text-sm text-white dark:bg-zinc-100 dark:text-zinc-900"
        onClick={() => reset()}
      >
        Tekrar dene
      </button>
    </div>
  );
}
