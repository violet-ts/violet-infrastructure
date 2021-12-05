import * as fs from 'fs';
import { tmpdir } from 'os';
import * as path from 'path';

export interface TmpdirContext {
  open(): string;
  get(): string;
  close(): void;
}

const formatDate = (date: Date) => {
  return `${`000${date.getFullYear()}`.slice(-4)}-${`0${date.getMonth() + 1}`.slice(-2)}-${`0${date.getDate()}`.slice(
    -2,
  )}.${`0${date.getHours()}`.slice(-2)}-${`0${date.getMinutes()}`.slice(-2)}-${`0${date.getSeconds()}`.slice(
    -2,
  )}.${`00${date.getMilliseconds()}`.slice(-3)}`;
};

// NOTE: Lambda compatible.
export const createTmpdirContext = (): TmpdirContext => {
  let name: string | null = null;

  return {
    open(): string {
      if (name != null) throw new Error('already opened');
      name = path.resolve(tmpdir(), `vinf.${formatDate(new Date())}.d`);
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
        if (process.env.DEBUG_KEEP_VIOLET_TMP_CONTEXT === '1') {
          // eslint-disable-next-line no-console
          console.warn('DEBUG_KEEP_VIOLET_TMP_CONTEXT is set');
        } else {
          fs.rmSync(name, { recursive: true, maxRetries: 3, force: true });
        }
      } catch (err: unknown) {
        // eslint-disable-next-line no-console
        console.warn('failed to remove', err);
      } finally {
        name = null;
      }
    },
  };
};
