import Image from "next/image";
import type { ReactNode } from "react";
import { LegalLinks } from "@/components/legal-links";
import { APP_SUBTITLE, Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";

export function AuthCard({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-1 flex-col px-4 py-4 sm:px-10 sm:py-6">
      <div className="flex items-center justify-between">
        <Logo />
        <ThemeToggle />
      </div>
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-6 sm:py-10">
        <div className="rounded-3xl border-2 border-line bg-surface p-6 shadow-xs sm:p-8">
          <div className="mb-6 flex flex-col items-center text-center">
            <span className="grid size-24 place-items-center overflow-hidden rounded-full bg-white p-1 shadow-md ring-2 ring-ink/15">
              <Image
                src="/logo.png"
                alt="Logo TECNM Culiacán · Sistemas Computacionales y TICs"
                width={92}
                height={92}
                className="size-full object-contain"
                priority
              />
            </span>
            <p className="mt-3 font-display text-[11px] font-bold uppercase tracking-[0.14em] text-ink/75">
              {APP_SUBTITLE}
            </p>
          </div>
          {children}
        </div>
      </main>
      <LegalLinks className="mx-auto w-full max-w-md pb-[env(safe-area-inset-bottom)]" />
    </div>
  );
}
