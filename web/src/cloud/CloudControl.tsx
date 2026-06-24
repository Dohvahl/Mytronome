import { useState } from 'react';
import { useDrive } from './DriveContext';
import { isDriveConfigured } from './googleAuth';

/** Connect / disconnect Google Drive. Hidden entirely if no client id is set. */
export function CloudControl() {
  const { connected, connect, disconnect } = useDrive();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isDriveConfigured()) return null;

  if (connected) {
    return (
      <div className="cloud-control">
        <span className="cloud-status">Google Drive connected</span>
        <button type="button" className="cloud-disconnect" onClick={disconnect}>
          Disconnect
        </button>
      </div>
    );
  }

  const handleConnect = async () => {
    setBusy(true);
    setError(null);
    try {
      await connect();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Connection failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="cloud-control">
      <button
        type="button"
        className="cloud-connect"
        onClick={handleConnect}
        disabled={busy}
      >
        {busy ? 'Connecting…' : 'Connect Google Drive'}
      </button>
      {error && <p className="preset-error">{error}</p>}
    </div>
  );
}
