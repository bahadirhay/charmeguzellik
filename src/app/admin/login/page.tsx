import { redirect } from "next/navigation";
import { LoginForm } from "@/components/admin/LoginForm";
import { TechizmetBrandLogo } from "@/components/admin/TechizmetBrandLogo";
import { getAdminSession } from "@/lib/session";

export default async function AdminLoginPage() {
  const s = await getAdminSession();
  if (s.isLoggedIn) redirect("/admin/dashboard");
  return (
    <div className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mb-6 flex justify-center">
        <TechizmetBrandLogo variant="login" className="object-center" />
      </div>
      <h1 className="text-center text-lg font-semibold text-zinc-900 dark:text-zinc-50">Yönetim girişi</h1>
      <p className="mt-1 text-center text-sm text-zinc-500">
        Personel kullanıcı adı ile giriş yapın; ilk kurulumda ayrıca .env içindeki admin e-postası + şifre ile de
        (tam yetki) girilebilir. Seed sonrası <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">admin</code>{" "}
        kullanıcısı oluşmuş olabilir.
      </p>
      <LoginForm />
    </div>
  );
}
