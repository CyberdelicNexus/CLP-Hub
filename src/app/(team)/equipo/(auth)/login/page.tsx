import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ArrowLeft } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { LoginForm } from "./login-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth.login");
  return { title: t("title") };
}

export default async function LoginPage() {
  const t = await getTranslations("auth.login");
  const tCommon = await getTranslations("common");

  return (
    <main className="relative flex flex-1 items-center justify-center px-4 py-12">
      <div aria-hidden className="bg-aurora pointer-events-none absolute inset-0 opacity-60 dark:opacity-30" />

      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>

      <div className="relative w-full max-w-sm space-y-6 rounded-2xl bg-card p-8 shadow-lift ring-1 ring-foreground/10">
        <div className="space-y-2">
          <span aria-hidden className="block size-8 rounded-[10px] bg-primary ring-1 ring-foreground/10" />
          <p className="pt-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {tCommon("appName")}
          </p>
          <h1 className="text-xl font-semibold">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>

        <LoginForm />
      </div>

      <Link
        href="/"
        className="absolute bottom-8 inline-flex items-center gap-1.5 rounded-lg text-xs text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        <ArrowLeft className="size-3.5" aria-hidden />
        {t("backToSite")}
      </Link>
    </main>
  );
}
