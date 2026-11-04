import type { Metadata, Viewport } from "next";
import { Montserrat } from "next/font/google";
import { APP_NAME, APP_TAGLINE } from "@/components/logo";
import { Providers } from "@/components/providers";
import { THEME_SCRIPT } from "@/components/theme-toggle";
import "./globals.css";

const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: `${APP_TAGLINE} · Evaluación de proyectos`,
  description:
    "Plataforma de evaluación de proyectos de Sistemas Computacionales y TICs · TECNM Campus Culiacán: registro de equipos, entregas de prototipo y producto final, evaluación de jueces y resultados.",
  appleWebApp: { capable: true, title: APP_NAME, statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es"
      data-theme="light"
      suppressHydrationWarning
      className={`${montserrat.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="flex min-h-full flex-col font-sans">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
