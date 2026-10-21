import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { PrivacyCenter } from "./privacy-center";

export const metadata: Metadata = {
  title: "Privacidad de mi cuenta · C.O.D.E",
  robots: { index: false, follow: false },
};

export default function PrivacidadCuentaPage() {
  return (
    <AppShell requireVerified={false}>
      <PrivacyCenter />
    </AppShell>
  );
}
