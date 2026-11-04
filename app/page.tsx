import { Suspense } from "react";
import { Spinner } from "@/components/ui";
import { LoginForm } from "./login/login-form";

export default function HomePage() {
  return (
    <Suspense fallback={<Spinner />}>
      <LoginForm />
    </Suspense>
  );
}
