import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";

export const metadata: Metadata = {
  title: "Versiones · C.O.D.E",
};

export default function VersionesPage() {
  return <LegalPage documentKey="versiones" />;
}
