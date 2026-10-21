import { Suspense } from "react";
import { AppShell } from "@/components/app-shell";
import { Spinner } from "@/components/ui";
import { ProjectView } from "./project-view";

export default function ProjectPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <AppShell>
        <ProjectView />
      </AppShell>
    </Suspense>
  );
}
