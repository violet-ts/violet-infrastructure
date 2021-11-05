import { createHash } from 'crypto';

export const getHash6 = (s: string): string => {
  const hash = createHash('RSA-SHA1');
  hash.update(s);
  const hash6 = hash.digest().toString('hex').slice(0, 6);
  return hash6;
};
