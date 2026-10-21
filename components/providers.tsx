"use client";

import { AccessProvider } from "@/lib/access";
import { AuthProvider } from "@/lib/auth";
import { ToastProvider } from "./ui";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <AccessProvider>
        <ToastProvider>{children}</ToastProvider>
      </AccessProvider>
    </AuthProvider>
  );
}
