import { handleAccountInvitation, InvitationError } from "@/lib/server/account-invitations";

export async function POST(request: Request) {
  try {
    return Response.json(await handleAccountInvitation(request), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({ error: error instanceof InvitationError ? error.message : "No se pudo enviar el acceso. Intenta de nuevo." },
      { status: error instanceof InvitationError ? error.status : 503, headers: { "Cache-Control": "no-store" } });
  }
}
