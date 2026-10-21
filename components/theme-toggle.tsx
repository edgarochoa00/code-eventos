"use client";

import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

/** Script que corre antes del primer pintado: aplica el tema guardado o el del sistema. */
export const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem("theme");if(t!=="light"&&t!=="dark"){t=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}var d=document.documentElement;d.setAttribute("data-theme",t);var m=document.querySelector('meta[name="theme-color"]');if(m)m.setAttribute("content",t==="dark"?"#0e0b0c":"#f4f4f4")}catch(e){}})()`;

function applyTheme(theme: "light" | "dark") {
  const root = document.documentElement;
  root.setAttribute("data-theme", theme);
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme === "dark" ? "#0e0b0c" : "#f4f4f4");
  try {
    localStorage.setItem("theme", theme);
  } catch {
    // Modo privado sin localStorage: el tema dura solo esta visita
  }
}

/**
 * Botón de modo claro/oscuro. Los íconos se muestran con CSS según data-theme,
 * así el HTML del servidor y del cliente es idéntico (sin errores de hidratación).
 */
export function ThemeToggle({ className }: { className?: string }) {
  return (
    <button
      type="button"
      onClick={() => {
        const current = document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
        applyTheme(current === "dark" ? "light" : "dark");
      }}
      className={cn(
        "grid size-10 shrink-0 place-items-center rounded-xl text-ink transition hover:bg-ink/5 focus-visible:outline-2 focus-visible:outline-ink",
        className,
      )}
      aria-label="Cambiar entre modo claro y oscuro"
      title="Modo claro / oscuro"
    >
      <Moon className="size-[18px] dark:hidden" aria-hidden />
      <Sun className="hidden size-[18px] dark:block" aria-hidden />
    </button>
  );
}
