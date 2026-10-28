"use client";

import Link from "@/components/navigation/link";
import { useI18n } from "@/lib/i18n";

export function AuthReturnLink() {
  const { t } = useI18n();

  return (
    <Link
      href="/login"
      className="block text-center text-sm font-semibold text-primary underline underline-offset-4"
    >
      {t("Back to sign in")}
    </Link>
  );
}
