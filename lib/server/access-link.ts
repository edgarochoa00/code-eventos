import "server-only";

export function feriaAccessLink(firebaseLink: string) {
  const { searchParams } = new URL(firebaseLink);
  const code = searchParams.get("oobCode");
  if (searchParams.get("mode") !== "resetPassword" || !code) {
    throw new Error("Firebase no generó un enlace de contraseña válido.");
  }

  const link = new URL("https://feria2026.web.app/acceso");
  // El fragmento solo llega al navegador, así el código no aparece en los registros de Hosting.
  link.hash = new URLSearchParams({ oobCode: code }).toString();
  return link.href;
}
