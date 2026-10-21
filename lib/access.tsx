"use client";

import { doc, onSnapshot } from "firebase/firestore";
import { createContext, useContext, useEffect, useState } from "react";
import { useAuth } from "./auth";
import { db } from "./firebase";
import { SUPERADMIN_EMAIL, type GlobalRole, type StaffDoc } from "./types";
import { normalizeEmail } from "./utils";

export type Access = {
  role: GlobalRole;
  loading: boolean;
  isSuperadmin: boolean;
  /** Superadmin o admin: administra todos los eventos y ve usuarios. */
  isAdmin: boolean;
  canCreateEvents: boolean;
  blocked: boolean;
};

const DEFAULT: Access = {
  role: "user",
  loading: true,
  isSuperadmin: false,
  isAdmin: false,
  canCreateEvents: false,
  blocked: false,
};

const AccessContext = createContext<Access>(DEFAULT);

export function accessFor(role: GlobalRole): Omit<Access, "loading"> {
  return {
    role,
    isSuperadmin: role === "superadmin",
    isAdmin: role === "superadmin" || role === "admin",
    canCreateEvents: role === "superadmin" || role === "admin" || role === "organizer",
    blocked: role === "blocked",
  };
}

/** Lee el permiso global del usuario desde staff/{correo} en tiempo real. */
export function AccessProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const email = user?.emailVerified ? normalizeEmail(user.email ?? "") : "";
  const [state, setState] = useState<{ email: string; role: GlobalRole }>({ email: "", role: "user" });

  useEffect(() => {
    if (!email || email === SUPERADMIN_EMAIL) return;
    return onSnapshot(
      doc(db, "staff", email),
      (snap) => setState({ email, role: snap.exists() ? (snap.data() as StaffDoc).role : "user" }),
      () => setState({ email, role: "user" }),
    );
  }, [email]);

  let value: Access;
  // Sin sesión o sin correo verificado: AppShell se encarga de esos casos
  if (!email) value = { ...accessFor("user"), loading: false };
  else if (email === SUPERADMIN_EMAIL) value = { ...accessFor("superadmin"), loading: false };
  else value = { ...accessFor(state.email === email ? state.role : "user"), loading: state.email !== email };

  return <AccessContext.Provider value={value}>{children}</AccessContext.Provider>;
}

export function useAccess() {
  return useContext(AccessContext);
}
