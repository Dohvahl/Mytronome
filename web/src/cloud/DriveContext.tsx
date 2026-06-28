import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { driveAuth } from './driveAuth';

interface DriveValue {
  connected: boolean;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
}

const DriveContext = createContext<DriveValue | null>(null);

/** Holds the Drive connection state so the storage options react to it. */
export function DriveProvider({ children }: { children: ReactNode }) {
  const [connected, setConnected] = useState(() => driveAuth.isConnected());

  const value = useMemo<DriveValue>(
    () => ({
      connected,
      connect: async () => {
        await driveAuth.connect();
        setConnected(true);
      },
      disconnect: async () => {
        await driveAuth.disconnect();
        setConnected(false);
      },
    }),
    [connected],
  );

  return (
    <DriveContext.Provider value={value}>{children}</DriveContext.Provider>
  );
}

export function useDrive(): DriveValue {
  const ctx = useContext(DriveContext);
  if (!ctx) throw new Error('useDrive must be used within a DriveProvider.');
  return ctx;
}
