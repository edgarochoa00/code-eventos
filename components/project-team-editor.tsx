"use client";

import { useState, type FormEvent } from "react";
import { saveProjectTeam } from "@/lib/data";
import type { EventDoc, ProjectDoc } from "@/lib/types";
import { AdvisorsField, TeamFields, validateTeamFields } from "./project-team-fields";
import { Button, firestoreErrorMessage, useToast } from "./ui";

export function ProjectTeamEditor({ event, project, onClose }: { event: EventDoc; project: ProjectDoc; onClose: () => void }) {
  const toast = useToast();
  const [original] = useState(project);
  const leader = original.members.find((member) => member.email === original.leaderEmail) ?? { email: original.leaderEmail, name: "" };
  const [leaderName, setLeaderName] = useState(leader.name);
  const [members, setMembers] = useState(() => original.members.filter((member) => member.email !== leader.email));
  const [advisors, setAdvisors] = useState(original.advisors ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (saving) return;
    const team = validateTeamFields(leader, leaderName, members, event.maxTeamSize);
    setErrors(team.errors);
    setError("");
    if (Object.keys(team.errors).length) return;

    setSaving(true);
    try {
      const failedInvitations = await saveProjectTeam(event.id, original, { members: team.members, advisors });
      if (failedInvitations.length) {
        toast(`Equipo actualizado. Puedes reenviar el acceso a ${failedInvitations.join(", ")} desde el proyecto.`, "error");
      } else toast("Equipo actualizado.");
      onClose();
    } catch (err) {
      setError(firestoreErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <fieldset className="space-y-4" disabled={saving}>
        <AdvisorsField value={advisors} onChange={setAdvisors} />
        <TeamFields leader={leader} leaderName={leaderName} leaderNameLabel="Nombre del líder"
          onLeaderNameChange={setLeaderName} members={members} onMembersChange={setMembers}
          maxTeamSize={event.maxTeamSize} errors={errors} />
      </fieldset>
      {error && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{error}</p>}
      <div className="flex flex-col-reverse gap-2 border-t border-line pt-4 sm:flex-row sm:justify-end">
        <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>Cancelar</Button>
        <Button type="submit" loading={saving}>Guardar equipo</Button>
      </div>
    </form>
  );
}
