import { randomUUID } from 'node:crypto';
import { mkdir, lstat, open, unlink } from 'node:fs/promises';
import { resolve, join } from 'node:path';

export interface MediaStorageService {
  put(key: string, bytes: Buffer): Promise<void>;
  read(key: string): Promise<Buffer>;
  remove(key: string): Promise<void>;
}
export const newStorageKey = () => `${randomUUID()}.webp`;
export const isStorageKey = (key: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.webp$/.test(key);

// A private, service-owned directory, never exposed through express.static.
// Provider failures deliberately omit filesystem paths.
export class LocalDevelopmentStorage implements MediaStorageService {
  private readonly root: string;
  constructor(root: string) {
    this.root = resolve(root);
  }
  private async path(key: string) {
    if (!isStorageKey(key)) throw new Error('Invalid media key');
    await mkdir(this.root, { recursive: true });
    if ((await lstat(this.root)).isSymbolicLink()) throw new Error('Invalid media directory');
    return join(this.root, key);
  }
  async put(key: string, bytes: Buffer) {
    try {
      const path = await this.path(key);
      const handle = await open(path, 'wx', 0o600);
      try {
        await handle.writeFile(bytes);
      } catch {
        await handle.close();
        await unlink(path);
        throw new Error('Media write failed');
      }
      await handle.close();
    } catch {
      throw new Error('Media storage unavailable');
    }
  }
  async read(key: string) {
    try {
      const path = await this.path(key);
      const stat = await lstat(path);
      if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 5 * 1024 * 1024) throw new Error();
      const handle = await open(path, 'r');
      try {
        return await handle.readFile();
      } finally {
        await handle.close();
      }
    } catch {
      throw new Error('Media unavailable');
    }
  }
  async remove(key: string) {
    try {
      const path = await this.path(key);
      try {
        await unlink(path);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      }
    } catch {
      throw new Error('Media removal unavailable');
    }
  }
}
