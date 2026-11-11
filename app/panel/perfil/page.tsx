import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { APP_NAME } from "@/components/logo";
import { ProfileView } from "./profile-view";

export const metadata: Metadata = {
  title: `Mi perfil · ${APP_NAME}`,
  robots: { index: false, follow: false },
};

export default function ProfilePage() {
  return (
    <AppShell requireVerified={false}>
      <ProfileView />
    </AppShell>
  );
}
