import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";
import { APP_NAME } from "@/components/logo";

export const metadata: Metadata = {
  title: `Versiones · ${APP_NAME}`,
};

export default function VersionesPage() {
  return <LegalPage documentKey="versiones" />;
}
