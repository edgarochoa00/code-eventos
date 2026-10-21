import type { Metadata, Viewport } from "next";
import { Martian_Mono, Ubuntu } from "next/font/google";
import { Providers } from "@/components/providers";
import { THEME_SCRIPT } from "@/components/theme-toggle";
import "./globals.css";

const martian = Martian_Mono({ variable: "--font-martian", subsets: ["latin", "latin-ext"] });
const ubuntu = Ubuntu({ variable: "--font-ubuntu", subsets: ["latin", "latin-ext"], weight: ["400", "500", "700"] });

export const metadata: Metadata = {
  title: "C.O.D.E · Evaluación de proyectos",
  description:
    "Organiza eventos escolares de proyectos: equipos, entregas de prototipo y producto final, evaluación de jueces y detección de plagio.",
  appleWebApp: { capable: true, title: "C.O.D.E", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#f4f4f4",
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
      className={`${martian.variable} ${ubuntu.variable} h-full antialiased`}
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
