import "server-only";

export function feriaAccessLink(firebaseLink: string, projectPath?: string) {
  const { searchParams } = new URL(firebaseLink);
  const code = searchParams.get("oobCode");
  if (searchParams.get("mode") !== "resetPassword" || !code) {
    throw new Error("Firebase no generó un enlace de contraseña válido.");
  }

  const link = new URL("https://feria2026.web.app/acceso");
  // El fragmento solo llega al navegador, así el código no aparece en los registros de Hosting.
  const fragment = new URLSearchParams({ oobCode: code });
  if (projectPath) fragment.set("next", projectPath);
  link.hash = fragment.toString();
  return link.href;
}
