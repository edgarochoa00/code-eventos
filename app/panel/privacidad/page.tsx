import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { APP_NAME } from "@/components/logo";
import { PrivacyCenter } from "./privacy-center";

export const metadata: Metadata = {
  title: `Privacidad de mi cuenta · ${APP_NAME}`,
  robots: { index: false, follow: false },
};

export default function PrivacidadCuentaPage() {
  return (
    <AppShell requireVerified={false}>
      <PrivacyCenter />
    </AppShell>
  );
}
