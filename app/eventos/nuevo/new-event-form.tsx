"use client";

import { ArrowLeft, Lock } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { EventSettingsForm } from "@/components/event-settings-form";
import { Card, EmptyState } from "@/components/ui";
import { useAccess } from "@/lib/access";
import { useAuth } from "@/lib/auth";
import { createEvent } from "@/lib/data";

export function NewEventForm() {
  const { user } = useAuth();
  const access = useAccess();
  const router = useRouter();

  const back = (
    <Link href="/panel" className="mb-4 inline-flex items-center gap-1.5 font-mono text-xs text-ink/60 hover:text-ink">
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
        <p className="mb-6 mt-1 font-mono text-xs text-ink/60">
          Después podrás invitar jueces, ajustar la rúbrica y abrir o cerrar cada etapa.
        </p>
        <EventSettingsForm
          submitLabel="Crear evento"
          onSubmit={async (input) => {
            if (!user) return;
            const id = await createEvent(input, user);
            router.push(`/eventos/${id}`);
          }}
        />
      </Card>
    </div>
  );
}
