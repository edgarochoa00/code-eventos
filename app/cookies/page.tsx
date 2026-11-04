import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";
import { APP_NAME } from "@/components/logo";

export const metadata: Metadata = {
  title: `Cookies y almacenamiento · ${APP_NAME}`,
};

export default function CookiesPage() {
  return <LegalPage documentKey="cookies" />;
}
