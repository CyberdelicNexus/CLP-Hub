import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { LoginForm } from "./login-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth.login");
  return { title: t("title") };
}

export default async function LoginPage() {
  const t = await getTranslations("auth.login");
  return (
    <main className="flex flex-1 items-center justify-center bg-muted/40 px-4 py-12">
      <div className="w-full max-w-sm space-y-6 rounded-xl border bg-card p-8 shadow-sm">
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">CLP Hub</p>
          <h1 className="text-xl font-semibold">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}
