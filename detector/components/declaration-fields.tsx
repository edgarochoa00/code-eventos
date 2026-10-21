"use client";

import { Field, Textarea } from "@/components/ui";
import type { Declaration } from "@/lib/detector/types";

export const EMPTY_DECLARATION: Declaration = { continues: "", sources: "" };

/** Declaración de originalidad del equipo: lo declarado no genera alertas por reuso legítimo. */
export function DeclarationFields({ value, onChange }: { value: Declaration; onChange: (v: Declaration) => void }) {
  return (
    <fieldset className="space-y-4 rounded-2xl border border-ink/10 p-4">
      <legend className="px-1 font-mono text-xs font-medium text-ink/80">Declaración de originalidad</legend>
      <Field
        label="¿Continúa un proyecto anterior?"
        htmlFor="decl-continues"
        hint="Si es la continuación de un proyecto suyo, escribe su nombre, año o enlace. Déjalo vacío si es nuevo."
      >
        <Textarea
          id="decl-continues"
          rows={2}
          value={value.continues}
          onChange={(e) => onChange({ ...value, continues: e.target.value })}
          maxLength={500}
        />
      </Field>
      <Field
        label="Plantillas, librerías o código de terceros"
        htmlFor="decl-sources"
        hint="Pega los enlaces de lo que reutilizan (plantillas, repositorios base, tutoriales). Esos enlaces no cuentan como coincidencia."
      >
        <Textarea
          id="decl-sources"
          rows={2}
          value={value.sources}
          onChange={(e) => onChange({ ...value, sources: e.target.value })}
          maxLength={1000}
        />
      </Field>
    </fieldset>
  );
}
