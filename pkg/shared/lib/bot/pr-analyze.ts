import parseDiff from 'parse-diff';

export interface ParsePrParams {
  // find ./docker/ -type f -a -name 'Dockerfile'
  dockerfilesOutput: string;
  // find ./pkg/ -type f -a -name 'package.json'
  projectPackagesOutput: string;
  // git diff --no-color
  diffOutput: string;
  // git diff --no-color --name-only
  diffNamesOutput: string;
  // git log --no-color base..HEAD --format=format:%s
  logOutput: string;
}

export interface PrAnalyzeParams {
  dockerfiles: string[];
  projectPackages: string[];
  chanegdFiles: string[];
  changes: { type: 'add' | 'del' | 'normal'; content: string }[];
  commits: string[];
}

export const parsePr = ({
  logOutput,
  diffOutput,
  diffNamesOutput,
  dockerfilesOutput,
  projectPackagesOutput,
}: ParsePrParams): PrAnalyzeParams => {
  const files = parseDiff(diffOutput);

  return {
    changes: files.flatMap((f) => f.chunks.flatMap((e) => e.changes)),
    commits: logOutput
      .split('\n')
      .map((o) => o.trim())
      .filter((o) => o),
    dockerfiles: dockerfilesOutput
      .split('\n')
      .map((o) => o.trim())
      .map((o) => (o.startsWith('./') ? o.slice(2) : o))
      .filter((o) => o.endsWith('/Dockerfile'))
      .map((o) => o.slice(0, -'/Dockerfile'.length))
      .filter((o) => o),
    projectPackages: projectPackagesOutput
      .split('\n')
      .map((o) => o.trim())
      .map((o) => (o.startsWith('./') ? o.slice(2) : o))
      .filter((o) => o.endsWith('/package.json'))
      .map((o) => o.slice(0, -'/package.json'.length))
      .filter((o) => o),
    chanegdFiles: diffNamesOutput
      .split('\n')
      .map((o) => o.trim())
      .filter((o) => o),
  };
};

export const prAnalyze = ({
  commits,
  changes,
  chanegdFiles,
  dockerfiles,
  projectPackages,
}: PrAnalyzeParams): string[] => {
  const tags = new Set<string>();

  commits.forEach((c) => {
    if (c.startsWith('feat')) tags.add('feat');
    if (c.startsWith('docs')) tags.add('documentation');
    if (c.startsWith('refactor')) tags.add('refactor');
    if (c.startsWith('fix')) tags.add('bug');
  });

  const changedLines = changes.filter((c) => c.type !== 'normal').filter((c) => c.content.match(/\S/)).length;
  if (changedLines <= 10) tags.add('diff/XS');
  else if (changedLines <= 60) tags.add('diff/S');
  else if (changedLines <= 300) tags.add('diff/M');
  else if (changedLines <= 1000) tags.add('diff/L');
  else if (changedLines <= 3000) tags.add('diff/XL');
  else tags.add('diff/XXL');

  const addTODO = changes.filter((c) => c.type === 'add').some((c) => c.content.match(/\bTODO\b.*:/));
  if (addTODO) tags.add('add/TODO');

  chanegdFiles.forEach((f) => {
    const p = projectPackages.filter((p) => p.startsWith('pkg/')).find((p) => f.startsWith(`${p}/`));
    if (p) tags.add(p);
  });

  chanegdFiles.forEach((f) => {
    const p = dockerfiles.filter((p) => p.startsWith('docker/')).find((p) => f.startsWith(`${p}/`));
    if (p) tags.add(p);
  });

  return [...tags];
};
