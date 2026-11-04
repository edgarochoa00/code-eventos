import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";
import { APP_NAME } from "@/components/logo";

export const metadata: Metadata = {
  title: `Términos y condiciones · ${APP_NAME}`,
  robots: { index: false, follow: true },
};

export default function TerminosPage() {
  return <LegalPage documentKey="terminos" />;
}
