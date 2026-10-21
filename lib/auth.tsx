"use client";

import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as fbSignOut,
  updateProfile,
  type User,
} from "firebase/auth";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { auth } from "./firebase";
import { upsertUserProfile } from "./data";

type AuthState = {
  user: User | null;
  loading: boolean;
  signInEmail: (email: string, password: string) => Promise<void>;
  signUpEmail: (name: string, email: string, password: string) => Promise<void>;
  signInGoogle: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  resendVerification: () => Promise<void>;
  refreshUser: () => Promise<boolean>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  // Fuerza re-render tras user.reload(), que muta el mismo objeto
  const [, setVersion] = useState(0);

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
      if (u) upsertUserProfile(u).catch(() => undefined);
    });
  }, []);

  const signInEmail = useCallback(async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email.trim(), password);
  }, []);

  const signUpEmail = useCallback(async (name: string, email: string, password: string) => {
    const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
    await updateProfile(cred.user, { displayName: name.trim() });
    auth.languageCode = "es";
    await sendEmailVerification(cred.user);
    await upsertUserProfile(cred.user);
    setVersion((v) => v + 1);
  }, []);

  const signInGoogle = useCallback(async () => {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    await signInWithPopup(auth, provider);
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    auth.languageCode = "es";
    await sendPasswordResetEmail(auth, email.trim());
  }, []);

  const resendVerification = useCallback(async () => {
    if (!auth.currentUser) return;
    auth.languageCode = "es";
    await sendEmailVerification(auth.currentUser);
  }, []);

  const refreshUser = useCallback(async () => {
    if (!auth.currentUser) return false;
    await auth.currentUser.reload();
    // Renueva el token para que las reglas vean email_verified = true
    await auth.currentUser.getIdToken(true);
    setUser(auth.currentUser);
    setVersion((v) => v + 1);
    return auth.currentUser.emailVerified;
  }, []);

  const signOut = useCallback(() => fbSignOut(auth), []);

  const value = useMemo(
    () => ({ user, loading, signInEmail, signUpEmail, signInGoogle, resetPassword, resendVerification, refreshUser, signOut }),
    [user, loading, signInEmail, signUpEmail, signInGoogle, resetPassword, resendVerification, refreshUser, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de AuthProvider");
  return ctx;
}

const AUTH_ERRORS: Record<string, string> = {
  "auth/invalid-credential": "Correo o contraseña incorrectos.",
  "auth/invalid-email": "El correo no es válido.",
  "auth/user-not-found": "No existe una cuenta con ese correo.",
  "auth/wrong-password": "Correo o contraseña incorrectos.",
  "auth/email-already-in-use": "Ya existe una cuenta con ese correo. Inicia sesión.",
  "auth/weak-password": "La contraseña debe tener al menos 6 caracteres.",
  "auth/too-many-requests": "Demasiados intentos. Espera un momento.",
  "auth/popup-closed-by-user": "Se cerró la ventana de Google.",
  "auth/operation-not-allowed": "Este método de acceso no está habilitado en Firebase.",
  "auth/configuration-not-found": "Firebase Authentication no está activado en el proyecto.",
  "auth/network-request-failed": "Sin conexión. Revisa tu internet.",
};

export function authErrorMessage(err: unknown) {
  const code = (err as { code?: string })?.code ?? "";
  return AUTH_ERRORS[code] ?? "Ocurrió un error. Intenta de nuevo.";
}
