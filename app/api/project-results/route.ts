import { computeStandings, type TeamResult } from "@/lib/results";
import { adminServices } from "@/lib/server/firebase-admin";
import { validDocumentId } from "@/lib/submission-files";
import { PHASES, type EvaluationDoc, type EventDoc, type ProjectDoc, type StaffDoc } from "@/lib/types";
import { normalizeEmail, rolesInEvent } from "@/lib/utils";

function reply(data: object, status = 200) {
  return Response.json(data, { status, headers: { "Cache-Control": "private, no-store" } });
}

export async function GET(request: Request) {
  const header = request.headers.get("authorization") ?? "";
  if (!/^Bearer \S+$/.test(header) || header.length > 16_384) {
    return reply({ error: "Inicia sesión para consultar tus calificaciones." }, 401);
  }

  const params = new URL(request.url).searchParams;
  const eventId = params.get("eventId");
  const projectId = params.get("projectId");
  if (!validDocumentId(eventId) || !validDocumentId(projectId)) {
    return reply({ error: "El evento o proyecto no es válido." }, 400);
  }

  try {
    const { auth, db } = adminServices();
    const identity = await auth.verifyIdToken(header.slice(7), true).catch(() => null);
    if (!identity) return reply({ error: "Tu sesión caducó. Vuelve a iniciar sesión." }, 401);
    if (!identity.email || !identity.email_verified) return reply({ error: "Verifica tu correo para continuar." }, 403);

    const email = normalizeEmail(identity.email);
    const eventRef = db.collection("events").doc(eventId);
    const projectRef = eventRef.collection("projects").doc(projectId);
    const grades = eventRef.collection("evaluations").where("projectId", "==", projectId)
      .select("projectId", "phase", "scores", "total", "comment", "judgeId");

    // Comprueba la publicación y la pertenencia con la misma lectura que las calificaciones.
    return await db.runTransaction(async (tx) => {
      const [eventDoc, projectDoc, staffDoc, withdrawn] = await tx.getAll(
        eventRef, projectRef, db.collection("staff").doc(email), db.collection("withdrawnAccounts").doc(identity.uid),
      );
      const event = eventDoc.data() as EventDoc | undefined;
      const project = projectDoc.data() as ProjectDoc | undefined;
      const role = (staffDoc.data() as StaffDoc | undefined)?.role;
      if (!event || !project?.memberEmails?.includes(email) || project.registrationPending ||
          role === "blocked" || withdrawn.exists || !rolesInEvent(event, email, role === "admin").includes("student")) {
        return reply({ error: "Solo el equipo puede consultar este resumen." }, 403);
      }
      if (event.resultsPublished !== true) return reply({ error: "Las calificaciones aún no están publicadas." }, 404);

      const currentProject = { ...project, id: projectId };
      const evaluations = (await tx.get(grades)).docs.map((doc) => doc.data() as Pick<
        EvaluationDoc, "projectId" | "phase" | "scores" | "total" | "comment" | "judgeId"
      >);
      const standings = computeStandings(event, [currentProject], evaluations);
      const results: TeamResult[] = [];
      for (const phase of PHASES) {
        const summary = standings[phase][0];
        if (!summary) continue;
        const judges = new Set(evaluations.filter((grade) => grade.phase === phase && grade.judgeId).map((grade) => grade.judgeId));
        if (judges.size < 2) continue;
        // El orden alfabético del texto es independiente del autor y la hora de envío.
        const comments = summary.comments.map((comment) => comment.trim()).filter(Boolean).sort();
        results.push({ phase, score: summary.score, comments });
      }
      return reply({ results });
    }, { readOnly: true });
  } catch {
    return reply({ error: "No se pudieron consultar las calificaciones." }, 503);
  }
}
