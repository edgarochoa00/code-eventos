import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";
import { APP_NAME } from "@/components/logo";

export const metadata: Metadata = {
  title: `Aviso de privacidad · ${APP_NAME}`,
  robots: { index: false, follow: true },
};

export default function PrivacidadPage() {
  return <LegalPage documentKey="privacidad" />;
}
