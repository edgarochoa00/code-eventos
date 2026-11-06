"use client";

import { useAuth } from "@/lib/auth";
import { updateProjectInfo } from "@/lib/data";
import type { EventDoc, ProjectDoc } from "@/lib/types";
import { eventCategories } from "@/lib/utils";
import { ProjectForm } from "./project-form";
import { Card, SectionTitle, firestoreErrorMessage, useToast } from "./ui";

/** El alta administrativa reserva el lugar; solo el líder completa este formulario. */
export function ProjectRegistration({ event, project }: { event: EventDoc; project: ProjectDoc }) {
  const { user, updateName } = useAuth();
  const toast = useToast();
  const locked = event.resultsPublished || event.categoryLocked || event.judgingOpen || event.accessVersion !== 1;
  const leader = { name: project.members.find((member) => member.email === project.leaderEmail)?.name || user?.displayName || "", email: project.leaderEmail };
  return (
    <Card className="sm:p-8">
      <SectionTitle title="Completa el registro de tu proyecto" subtitle={event.name} />
      <p className="mb-5 text-sm text-muted">Te dieron de alta como alumno líder con tu correo. Ahora escribe tu nombre,
        los datos del proyecto, elige su categoría y agrega a tus integrantes.</p>
      {locked ? (
        <p role="alert" className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">
          {event.accessVersion !== 1 ? "El evento necesita una actualización de permisos."
            : "El evento ya comenzó la evaluación o tiene resultados publicados. Pide al organizador que revise tu registro pendiente."}
        </p>
      ) : (
        <ProjectForm initial={project} leader={leader} maxTeamSize={event.maxTeamSize} categories={eventCategories(event)}
          submitLabel="Completar registro" onSubmit={async (input) => {
            if (!user || user.uid !== project.leaderId) return;
            try {
              const name = input.members.find((member) => member.email === project.leaderEmail)?.name ?? "";
              if (name && name !== user.displayName) await updateName(name);
              await updateProjectInfo(event, project, input, user);
              toast("Proyecto registrado. Ya puedes consultar las entregas de tu evento.");
            } catch (error) { toast(firestoreErrorMessage(error), "error"); }
          }} />
      )}
    </Card>
  );
}
