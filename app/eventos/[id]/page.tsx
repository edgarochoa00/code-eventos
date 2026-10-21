import { Suspense } from "react";
import { AppShell } from "@/components/app-shell";
import { Spinner } from "@/components/ui";
import { EventView } from "./event-view";

export default function EventPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <AppShell>
        <EventView />
      </AppShell>
    </Suspense>
  );
}
