import { ArrowLeft, Maximize2 } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import standMap from "@/public/feria-2026/croquis-stands.webp";

export const metadata: Metadata = {
  title: "Croquis de stands · Feria 2026",
  description: "Ubicación de los stands de la Feria de Ingeniería 2026 en el Centro de Información.",
};

export default function CroquisPage() {
  return (
    <>
      <header className="mx-auto flex min-h-20 w-full max-w-6xl items-center justify-between gap-3 px-4 pt-[env(safe-area-inset-top)] sm:px-8">
        <Logo />
        <ThemeToggle />
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-8 sm:px-8">
        <Link href="/" className="inline-flex min-h-11 items-center gap-2 text-sm text-muted hover:text-ink">
          <ArrowLeft className="size-4" aria-hidden /> Volver al inicio
        </Link>
        <section className="ui-panel mt-2 space-y-4 rounded-3xl p-4 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <h1 className="font-display text-2xl font-bold sm:text-3xl">Croquis de stands</h1>
              <p className="mt-1 text-sm text-muted">Centro de Información · Feria de Ingeniería 2026</p>
            </div>
            <a href={standMap.src} target="_blank" rel="noopener"
              className="inline-flex min-h-11 items-center gap-2 rounded-full border border-control px-4 text-sm font-semibold hover:bg-field focus-visible:outline-2 focus-visible:outline-ink">
              <Maximize2 className="size-4" aria-hidden /> Ampliar imagen
            </a>
          </div>
          <Image src={standMap} unoptimized
            alt="Plano del Centro de Información con los nombres y números de los 53 stands, el escenario a la izquierda y las gradas abajo."
            className="h-auto w-full rounded-xl border border-line bg-white" />
        </section>
      </main>
    </>
  );
}
