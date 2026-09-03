"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { signOut } from "@/app/(team)/equipo/actions";
import { Button } from "@/components/ui/button";

export function LogoutButton() {
  const t = useTranslations("auth");
  const [pending, startTransition] = useTransition();
  return (
    <Button variant="outline" size="sm" disabled={pending} onClick={() => startTransition(() => signOut())}>
      {t("logout")}
    </Button>
  );
}
