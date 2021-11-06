import * as path from 'path';
import type { Section } from '@self/shared/lib/def/types';
import { PROJECT_NAME } from '@self/shared/lib/const';
import { getHash6 } from '@self/shared/lib/util/string';

export const genTags = (name: string | null, namespace: string, section: Section): Record<string, string> => {
  const tags: Record<string, string> = {
    Project: PROJECT_NAME,
    Namespace: namespace,
    NamespaceHash6: getHash6(namespace),
    Managed: 'true',
    Section: section,
  };
  if (name != null) tags.Name = name;
  return tags;
};
export const dataDir = path.resolve(__dirname, '..', '..', 'data');
