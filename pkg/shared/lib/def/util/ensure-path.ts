import * as fs from 'fs';

// for fail-fast
export const ensurePath = (p: string): string => {
  if (p.match(/['"${}\n\r\\]/)) throw new Error(`Path "${p}" is not safe.`);
  if (!fs.existsSync(p)) throw new Error(`Path "${p}" not found.`);
  return p;
};
