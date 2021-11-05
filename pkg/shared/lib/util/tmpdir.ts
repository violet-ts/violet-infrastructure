import format from 'date-fns/format';
import { tmpdir } from 'os';
import * as path from 'path';
import * as fs from 'fs';

export interface TmpdirContext {
  open(): string;
  get(): string;
  close(): void;
}

// NOTE: Lambda compatible.
export const createTmpdirContext = (): TmpdirContext => {
  let name: string | null = null;

  return {
    open(): string {
      if (name != null) throw new Error('already opened');
      name = path.resolve(tmpdir(), `vinf.${format(new Date(), 'yyyy-MM-dd.HH-mm-ss.SSS')}.d`);
      fs.mkdirSync(name, { recursive: true });
      return name;
    },
    get(): string {
      if (name == null) throw new Error('not opened yet');
      return name;
    },
    close(): void {
      if (name == null) throw new Error('not opened yet');
      try {
        fs.rmSync(name, { recursive: true, maxRetries: 3, force: true });
      } catch (err: unknown) {
        // eslint-disable-next-line no-console
        console.warn('failed to remove', err);
      } finally {
        name = null;
      }
    },
  };
};
