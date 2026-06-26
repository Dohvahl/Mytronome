import type { Preset, PresetStore } from '@mytronome/presets';
import { getAccessToken } from './googleAuth';

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

  async list(): Promise<Preset[]> {
    const token = await getAccessToken();
    const id = await this.findFileId(token);
    if (!id) return [];

    const res = await fetch(`${DRIVE}/files/${id}?alt=media`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok)
      throw new Error(`Couldn't read presets from Drive (${res.status}).`);

    const data = await res.json();
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

  private async writeAll(presets: Preset[]): Promise<void> {
    const token = await getAccessToken();
    const body = JSON.stringify(presets);
    const id = await this.findFileId(token);

    if (id) {
      // Overwrite the existing file's content.
      const res = await fetch(`${UPLOAD}/files/${id}?uploadType=media`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body,
      });
      if (!res.ok) throw new Error(`Couldn't save to Drive (${res.status}).`);
      return;
    }

    // Create the file in the appDataFolder (multipart: metadata + content).
    const metadata = { name: FILE_NAME, parents: ['appDataFolder'] };
    const multipart =
      `--${BOUNDARY}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` +
      `${JSON.stringify(metadata)}\r\n` +
      `--${BOUNDARY}\r\nContent-Type: application/json\r\n\r\n${body}\r\n` +
      `--${BOUNDARY}--`;

    const res = await fetch(`${UPLOAD}/files?uploadType=multipart&fields=id`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': `multipart/related; boundary=${BOUNDARY}`,
      },
      body: multipart,
    });
    if (!res.ok)
      throw new Error(`Couldn't create the Drive file (${res.status}).`);
    const data = await res.json();
    this.fileId = data.id;
  }
}
