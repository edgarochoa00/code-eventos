"use client";

import {
  onSnapshot,
  type DocumentReference,
  type Query,
} from "firebase/firestore";
import { useEffect, useState } from "react";
import { loadAllFingerprints } from "./data";
import type { FingerprintDoc } from "./types";

type State<T> = { key: string; data: T; error: string | null };

/**
 * Suscripción en tiempo real a un documento. `key` debe cambiar cuando cambie la referencia.
 * El estado de carga se deriva de si el último resultado corresponde a la key actual.
 */
export function useDocument<T>(ref: DocumentReference | null, key: string) {
  const [state, setState] = useState<State<T | null>>({ key: "", data: null, error: null });

  useEffect(() => {
    if (!ref) return;
    return onSnapshot(
      ref,
      (snap) =>
        setState({ key, data: snap.exists() ? ({ id: snap.id, ...snap.data() } as T) : null, error: null }),
      (err) => setState({ key, data: null, error: err.code ?? err.message }),
    );
    // La key representa la referencia
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const ready = !ref || state.key === key;
  return { data: ready ? state.data : null, loading: !ready, error: ready ? state.error : null };
}

/** Carga (una vez) todas las huellas históricas para comparar originalidad. */
export function useFingerprints(enabled: boolean) {
  const [version, setVersion] = useState(0);
  const [state, setState] = useState<{ version: number; data: FingerprintDoc[]; error: string | null }>({
    version: -1,
    data: [],
    error: null,
  });

  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    loadAllFingerprints()
      .then((data) => alive && setState({ version, data, error: null }))
      .catch((err) => alive && setState({ version, data: [], error: err.code ?? "error" }));
    return () => {
      alive = false;
    };
  }, [enabled, version]);

  return {
    data: state.data,
    error: state.error,
    loading: enabled && state.version !== version,
    reload: () => setVersion((v) => v + 1),
  };
}

export function useCollection<T>(query: Query | null, key: string) {
  const [state, setState] = useState<State<T[]>>({ key: "", data: [], error: null });

  useEffect(() => {
    if (!query) return;
    return onSnapshot(
      query,
      (snap) => setState({ key, data: snap.docs.map((d) => ({ id: d.id, ...d.data() }) as T), error: null }),
      (err) => setState({ key, data: [], error: err.code ?? err.message }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const ready = !query || state.key === key;
  return { data: ready ? state.data : [], loading: !ready, error: ready ? state.error : null };
}
