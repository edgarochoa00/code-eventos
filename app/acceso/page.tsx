import type { Metadata } from "next";
import { AuthCard } from "@/components/auth-card";
import { AccessForm } from "./access-form";

export const metadata: Metadata = {
  title: "Configura tu acceso · Feria 2026",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default function AccessPage() {
  return <AuthCard><AccessForm /></AuthCard>;
}
