import { PROJECT_NAME } from '../../const';
import type { Section } from '../types';

export const genTags = (name: string | null, namespace: string, section: Section): Record<string, string> => {
  const tags: Record<string, string> = {
    Project: PROJECT_NAME,
    Namespace: namespace,
    Managed: 'true',
    Section: section,
  };
  if (name != null) tags.Name = name;
  return tags;
};
