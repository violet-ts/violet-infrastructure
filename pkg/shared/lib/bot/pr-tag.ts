// TODO(hardcoded)
export const getLabelInfo = (
  newLabel: string,
): {
  color: string;
  description: string;
} => {
  if (newLabel.startsWith('pkg/')) return { color: '506BD4', description: '' };
  if (newLabel.startsWith('docker/')) return { color: '7510C5', description: '' };
  if (newLabel === 'diff/XS') return { color: '64682D', description: '差分が 10 行以下' };
  if (newLabel === 'diff/S') return { color: '64682D', description: '差分が 60 行以下' };
  if (newLabel === 'diff/M') return { color: '64682D', description: '差分が 300 行以下' };
  if (newLabel === 'diff/L') return { color: '64682D', description: '差分が 1000 行以下' };
  if (newLabel === 'diff/XL') return { color: '64682D', description: '差分が 3000 行以下' };
  if (newLabel === 'diff/XXL') return { color: '64682D', description: '差分が 3000 行超過' };
  if (newLabel.startsWith('add/')) return { color: 'DE2D08', description: '' };
  if (newLabel === 'feat') return { color: '78EB73', description: '' };
  if (newLabel === 'bug') return { color: 'd73a4a', description: '' };
  if (newLabel === 'refactor') return { color: '1FE9D7', description: '' };
  if (newLabel === 'documentation') return { color: '0075ca', description: '' };
  throw new Error(`Unknown label "${newLabel}"`);
};

export const isManagedLabel = (label: string): boolean => {
  try {
    getLabelInfo(label);
    return true;
  } catch (_err: unknown) {
    return false;
  }
};
