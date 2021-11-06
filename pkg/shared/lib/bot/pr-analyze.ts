import parseDiff from 'parse-diff';
import * as path from 'path';
import conventionalCommitsParser from 'conventional-commits-parser';

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
  const labels = new Set<string>();

  commits.forEach((c) => {
    const { type } = conventionalCommitsParser.sync(c);
    if (type === 'feat') labels.add('feat');
    if (type === 'docs') labels.add('documentation');
    if (type === 'refactor') labels.add('refactor');
    if (type === 'fix') labels.add('bug');
    if (type === 'test') labels.add('test');
  });

  const changedLines = changes.filter((c) => c.type !== 'normal').filter((c) => c.content.match(/\S/)).length;
  if (changedLines <= 10) labels.add('diff/XS');
  else if (changedLines <= 60) labels.add('diff/S');
  else if (changedLines <= 300) labels.add('diff/M');
  else if (changedLines <= 1000) labels.add('diff/L');
  else if (changedLines <= 3000) labels.add('diff/XL');
  else labels.add('diff/XXL');

  const addTODO = changes.filter((c) => c.type === 'add').some((c) => c.content.match(/\bTODO\b.*:/));
  if (addTODO) labels.add('add/TODO');

  chanegdFiles.forEach((f) => {
    const p = projectPackages.filter((p) => p.startsWith('pkg/')).find((p) => f.startsWith(`${p}/`));
    if (p) labels.add(p);
  });

  chanegdFiles.forEach((f) => {
    const p = dockerfiles.filter((p) => p.startsWith('docker/')).find((p) => f.startsWith(`${p}/`));
    if (p) labels.add(p);
  });

  chanegdFiles.forEach((f) => {
    const basename = path.basename(f);
    if (
      ['.eslintrc', '.prettierrc', '.stylelintrc', 'commitlint.config'].some(
        (name) => name === basename || basename.startsWith(`${name}.`),
      )
    )
      labels.add('rule');
    if (['.eslintignore', '.prettierignore', '.stylelintignore', '.npmrc'].includes(basename)) labels.add('rule');
    if (['pnpm-lock.yaml'].includes(basename)) labels.add('update/lockfile');
    if (f.startsWith('.github/')) labels.add('rule');
    if (f.startsWith('.github/workflows/')) labels.add('update/ci');
    if (['CODEOWNERS'].includes(basename)) labels.add('update/codeowners');
    if (['.gitignore'].includes(basename)) labels.add('update/gitignore');
    if (['.dockerignore'].includes(basename)) labels.add('update/dockerignore');

    if (['package-lock.json'].includes(basename)) labels.add('invalid/package-lock');
    if (['yarn.lock'].includes(basename)) labels.add('invalid/yarn-lock');
    if (f.match(/\bprisma\b/)) labels.add('prisma');
    if (f.match(/\bprisma\/migrations\b/)) labels.add('prisma/migrations');
    if (basename === 'schema.prisma') labels.add('prisma/schema');
    if (basename.match(/\.test\./)) labels.add('test');
    if (basename.match(/\.spec\./)) labels.add('test');
    if (f.split('/').includes('test')) labels.add('test');
    if (f.split('/').includes('tests')) labels.add('test');
    if (f.split('/').includes('__test__')) labels.add('test');
    if (f.split('/').includes('__tests__')) labels.add('test');
  });

  return [...labels];
};
