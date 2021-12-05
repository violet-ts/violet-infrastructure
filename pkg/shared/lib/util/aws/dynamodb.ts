/* eslint-disable @typescript-eslint/no-unsafe-return,@typescript-eslint/no-explicit-any */
import type { AttributeValue } from '@aws-sdk/client-dynamodb';
import { marshall as utilMarhsall } from '@aws-sdk/util-dynamodb';

export const normalize = <T>(data: T, done: Set<unknown>): T => {
  if (done.has(data)) return data;
  done.add(data);
  if (Array.isArray(data)) {
    return data.map((e) => normalize(e, done)) as any;
  }
  if (data instanceof Set) {
    if (data.size === 0) return null as any;
    return data;
  }
  if (typeof data === 'object') {
    if (data === null) return data;
    return Object.fromEntries(Object.entries(data).map(([key, e]) => [key, normalize(e, done)])) as any;
  }
  return data;
};

export const marshall = <T extends { [K in keyof T]: any }>(
  data: T,
): {
  [key: string]: AttributeValue;
} => {
  const done = new Set();
  const normalized = normalize(data, done);
  return utilMarhsall(normalized, { removeUndefinedValues: true });
};
/* eslint-enable @typescript-eslint/no-unsafe-return,@typescript-eslint/no-explicit-any */
