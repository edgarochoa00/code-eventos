import { Suspense } from "react";
import { Spinner } from "@/components/ui";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <LoginForm />
    </Suspense>
  );
}
