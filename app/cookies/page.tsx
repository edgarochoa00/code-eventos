import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";

export const metadata: Metadata = {
  title: "Cookies y almacenamiento · C.O.D.E",
};

export default function CookiesPage() {
  return <LegalPage documentKey="cookies" />;
}
