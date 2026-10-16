import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { QrcAuthorizationRecord, QrcPayload } from "@/lib/qrc";

type RecoverySessionValue = {
  records: QrcAuthorizationRecord[];
  clearRecoverySession: () => void;
};

const RecoverySessionContext = createContext<RecoverySessionValue>({
  records: [],
  clearRecoverySession: () => undefined,
});

export function RecoverySessionProvider({
  initialPayload,
  children,
}: {
  initialPayload: QrcPayload | null;
  children?: ReactNode;
}) {
  const [payload, setPayload] = useState<QrcPayload | null>(initialPayload);

  useEffect(() => {
    const clearOnExit = () => setPayload(null);
    window.addEventListener("pagehide", clearOnExit);
    return () => window.removeEventListener("pagehide", clearOnExit);
  }, []);

  const value = useMemo<RecoverySessionValue>(() => ({
    records: payload?.authorizations ?? [],
    clearRecoverySession: () => setPayload(null),
  }), [payload]);

  return (
    <RecoverySessionContext.Provider value={value}>
      {children}
    </RecoverySessionContext.Provider>
  );
}

export function useRecoverySession() {
  return useContext(RecoverySessionContext);
}
