export interface NextBuildSummary {
  pages: NextBuildPage[];
  firstLoads: NextBuildFirstLoad[];
}

export type PageType = 'Server' | 'Static' | 'SSG' | 'ISR';

export interface NextBuildPage {
  path: string;
  rawType: string;
  type: PageType;
  sizeInBytes: number;
  firstLoadInBytes: number;
}

export interface NextBuildFirstLoad {
  path: string;
  sizeInBytes: number;
}

export const parseNextBuildOutput = (output: readonly string[]): NextBuildSummary => {
  const pages: NextBuildPage[] = [];
  const firstLoads: NextBuildFirstLoad[] = [];
  const body = output.slice(1, -4);
  for (const [i, line] of Object.entries(body)) {
    if (line.startsWith('+ First Load JS shared by all')) {
      firstLoads.push(...body.slice(Number.parseInt(i, 10) + 1).map(parseNextBuildFirstLoadLine));
      break;
    }
    pages.push(parseNextBuildPageLine(line));
  }
  return {
    pages,
    firstLoads,
  };
};

export const parseNextBuildPageLine = (line: string): NextBuildPage => {
  const matches = line.trim().match(/^\S+\s(.)\s(.*?)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)$/);
  if (!matches) throw new Error(`pattern not matched for next build page line: "${line}"`);
  const [, rawType, path, size, sizeUnit, firstLoadSize, firstLoadSizeUnit] = matches;
  return {
    path,
    rawType,
    type: parsePageType(rawType),
    sizeInBytes: parseBytes(size, sizeUnit),
    firstLoadInBytes: parseBytes(firstLoadSize, firstLoadSizeUnit),
  };
};

export const parseNextBuildFirstLoadLine = (line: string): NextBuildFirstLoad => {
  const matches = line.trim().match(/^\S+\s+(.*?)\s+(\S+)\s+(\S+)$/);
  if (!matches) throw new Error(`pattern not matched for next build first load line: "${line}"`);
  const [, path, size, sizeUnit] = matches;
  return {
    path,
    sizeInBytes: parseBytes(size, sizeUnit),
  };
};

export const parsePageType = (char: string): PageType => {
  switch (char) {
    case 'λ':
      return 'Server';
    case '○':
      return 'Static';
    case '●':
      return 'SSG';
    case ' ':
      return 'ISR';
    default:
      throw new Error('unknown page type');
  }
};

const UNITS = ['B', 'kB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

export const parseBytes = (size: string, sizeUnit: string): number => {
  const sizeUnitInBytes = 1000 ** UNITS.indexOf(sizeUnit);
  const sizeInBytes = Math.round(Number.parseFloat(size) * sizeUnitInBytes);
  return sizeInBytes;
};

export const parseActionsOutput = (output: readonly string[]): string[] => {
  const marker = 'info  - Finalizing page optimization...';
  const headIndex = output.findIndex((line) => line.endsWith(marker));
  const prefixLength = output[headIndex].length - marker.length;
  let index = headIndex;
  const lines: string[] = [];
  while (index + 1 < output.length) {
    index += 1;
    if (output[index].length <= prefixLength) continue;
    const line = output[index].slice(prefixLength);
    if (line.trim() === '') continue;
    if (line === 'Done') break;
    lines.push(line);
  }
  return lines;
};
