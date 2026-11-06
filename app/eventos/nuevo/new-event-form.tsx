"use client";

import { ArrowLeft, Lock } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { EventSettingsForm } from "@/components/event-settings-form";
import { Card, EmptyState } from "@/components/ui";
import { useAccess } from "@/lib/access";
import { useAuth } from "@/lib/auth";
import { createEvent } from "@/lib/data";
import { getCategoryCriteria } from "@/lib/event-config";

export function NewEventForm() {
  const { user } = useAuth();
  const access = useAccess();
  const router = useRouter();

  const back = (
    <Link href="/panel" className="mb-4 inline-flex items-center gap-1.5 font-mono text-xs text-muted hover:text-ink">
      <ArrowLeft className="size-3.5" /> Panel
    </Link>
  );

  if (!access.canCreateEvents) {
    return (
      <div className="mx-auto max-w-2xl">
        {back}
        <EmptyState
          icon={<Lock className="size-5" />}
          title="Necesitas permiso de organizador"
          text="Para crear eventos, pide a un administrador de la plataforma que te dé el permiso de Organizador."
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      {back}
      <Card className="sm:p-8">
        <h1 className="font-display text-3xl font-bold">Nuevo evento</h1>
        <p className="mb-6 mt-1 font-mono text-xs text-muted">
          Define los datos y los criterios de evaluación de este evento. Después podrás invitar jueces y abrir o cerrar el registro y las entregas.
        </p>
        <EventSettingsForm
          submitLabel="Crear evento"
          rubric
          onSubmit={async (input) => {
            if (!user) return;
            const criteria = getCategoryCriteria({ criteria: [], categoryCriteria: input.categoryCriteria }, input.categories![0]);
            const id = await createEvent({ ...input, criteria }, user);
            router.push(`/eventos/${id}`);
          }}
        />
      </Card>
    </div>
  );
}
