import {
  createContext,
  PropsWithChildren,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState
} from "react";

export type PendingScanPhoto = {
  source: "camera" | "library";
  uri: string;
  width?: number;
  height?: number;
};

type PendingScanContextValue = {
  photo: PendingScanPhoto | null;
  clear: () => void;
  consume: () => PendingScanPhoto | null;
  preserve: (photo: PendingScanPhoto) => void;
};

const PendingScanContext = createContext<PendingScanContextValue | null>(null);

export function PendingScanProvider({ children }: PropsWithChildren) {
  const [photo, setPhoto] = useState<PendingScanPhoto | null>(null);
  const photoRef = useRef<PendingScanPhoto | null>(null);
  const clear = useCallback(() => {
    photoRef.current = null;
    setPhoto(null);
  }, []);
  const preserve = useCallback((nextPhoto: PendingScanPhoto) => {
    photoRef.current = nextPhoto;
    setPhoto(nextPhoto);
  }, []);
  const consume = useCallback(() => {
    const current = photoRef.current;
    photoRef.current = null;
    setPhoto(null);
    return current;
  }, []);
  const value = useMemo(
    () => ({ photo, clear, consume, preserve }),
    [clear, consume, photo, preserve]
  );

  return <PendingScanContext.Provider value={value}>{children}</PendingScanContext.Provider>;
}

export function usePendingScan() {
  const context = useContext(PendingScanContext);
  if (!context) throw new Error("usePendingScan must be used inside PendingScanProvider.");
  return context;
}
