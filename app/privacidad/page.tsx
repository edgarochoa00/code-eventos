import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";

export const metadata: Metadata = {
  title: "Aviso de privacidad · C.O.D.E",
  robots: { index: false, follow: true },
};

export default function PrivacidadPage() {
  return <LegalPage documentKey="privacidad" />;
}
