import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { connectDrive, disconnectDrive, isDriveConnected } from './googleAuth';

interface DriveValue {
  connected: boolean;
  connect: () => Promise<void>;
  disconnect: () => void;
}

const DriveContext = createContext<DriveValue | null>(null);

/** Holds the Drive connection state so the storage options react to it. */
export function DriveProvider({ children }: { children: ReactNode }) {
  const [connected, setConnected] = useState<boolean>(() => isDriveConnected());

  const value = useMemo<DriveValue>(
    () => ({
      connected,
      connect: async () => {
        await connectDrive();
        setConnected(true);
      },
      disconnect: () => {
        disconnectDrive();
        setConnected(false);
      },
    }),
    [connected],
  );

  return <DriveContext.Provider value={value}>{children}</DriveContext.Provider>;
}

export function useDrive(): DriveValue {
  const ctx = useContext(DriveContext);
  if (!ctx) throw new Error('useDrive must be used within a DriveProvider.');
  return ctx;
}
