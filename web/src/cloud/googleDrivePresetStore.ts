import type { Preset, PresetStore } from '@mytronome/presets';
import { driveAuth } from './driveAuth';

const FILE_NAME = 'presets.json';
const DRIVE = 'https://www.googleapis.com/drive/v3';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3';
const BOUNDARY = 'mytronome-boundary';

/**
 * A PresetStore backed by the user's Google Drive — a single presets.json file
 * in the hidden appDataFolder. Each operation reads/writes the whole file, which
 * is fine for a handful of presets.
 */
export class GoogleDrivePresetStore implements PresetStore {
  private fileId: string | null = null;
  // The Drive `version` of the file as of our last read. Used to detect that
  // another device changed it before we overwrite (optimistic concurrency).
  private fileVersion: string | null = null;

  async list(): Promise<Preset[]> {
    const token = await driveAuth.getAccessToken();
    const id = await this.findFileId(token);
    if (!id) {
      this.fileVersion = null;
      return [];
    }

    const res = await fetch(`${DRIVE}/files/${id}?alt=media`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok)
      throw new Error(`Couldn't read presets from Drive (${res.status}).`);

    const data = await res.json();
    // Capture the version of what we just read, so a later write can tell whether
    // the file changed underneath us in the meantime.
    this.fileVersion = await this.fetchVersion(token, id);
    return Array.isArray(data) ? (data as Preset[]) : [];
  }

  async save(preset: Preset): Promise<void> {
    const all = await this.list();
    const index = all.findIndex((p) => p.id === preset.id);
    if (index >= 0) all[index] = preset;
    else all.push(preset);
    await this.writeAll(all);
  }

  async remove(id: string): Promise<void> {
    const all = await this.list();
    await this.writeAll(all.filter((p) => p.id !== id));
  }

  private async findFileId(token: string): Promise<string | null> {
    if (this.fileId) return this.fileId;
    const q = encodeURIComponent(`name='${FILE_NAME}'`);
    const res = await fetch(
      `${DRIVE}/files?spaces=appDataFolder&q=${q}&fields=files(id)`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!res.ok) throw new Error(`Couldn't access Drive (${res.status}).`);
    const data = await res.json();
    this.fileId = data.files?.[0]?.id ?? null;
    return this.fileId;
  }

  /** The file's `version` (Drive bumps it on every change). Best-effort. */
  private async fetchVersion(
    token: string,
    id: string,
  ): Promise<string | null> {
    const res = await fetch(`${DRIVE}/files/${id}?fields=version`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null; // a failed version read just disables the check
    const data = await res.json();
    return data.version ?? null;
  }

  private async writeAll(presets: Preset[]): Promise<void> {
    const token = await driveAuth.getAccessToken();
    const body = JSON.stringify(presets);
    const id = await this.findFileId(token);

    if (id) {
      // Optimistic concurrency: if the file changed on another device since we
      // last read it, don't blindly overwrite — surface a conflict so the caller
      // can reload and reapply. (Best-effort: Drive has no atomic compare-and-set,
      // so a small window remains between this check and the write below.)
      if (this.fileVersion !== null) {
        const current = await this.fetchVersion(token, id);
        if (current !== null && current !== this.fileVersion) {
          throw new Error(
            'Your presets were changed on another device. Reload and try again.',
          );
        }
      }

      // Overwrite the existing file's content.
      const res = await fetch(
        `${UPLOAD}/files/${id}?uploadType=media&fields=version`,
        {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body,
        },
      );
      if (!res.ok) throw new Error(`Couldn't save to Drive (${res.status}).`);
      const data = await res.json();
      this.fileVersion = data.version ?? null; // advance to the version we wrote
      return;
    }

    // Create the file in the appDataFolder (multipart: metadata + content).
    const metadata = { name: FILE_NAME, parents: ['appDataFolder'] };
    const multipart =
      `--${BOUNDARY}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` +
      `${JSON.stringify(metadata)}\r\n` +
      `--${BOUNDARY}\r\nContent-Type: application/json\r\n\r\n${body}\r\n` +
      `--${BOUNDARY}--`;

    const res = await fetch(
      `${UPLOAD}/files?uploadType=multipart&fields=id,version`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': `multipart/related; boundary=${BOUNDARY}`,
        },
        body: multipart,
      },
    );
    if (!res.ok)
      throw new Error(`Couldn't create the Drive file (${res.status}).`);
    const data = await res.json();
    this.fileId = data.id;
    this.fileVersion = data.version ?? null;
  }
}
