import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";

export const metadata: Metadata = {
  title: "Términos y condiciones · C.O.D.E",
  robots: { index: false, follow: true },
};

export default function TerminosPage() {
  return <LegalPage documentKey="terminos" />;
}
