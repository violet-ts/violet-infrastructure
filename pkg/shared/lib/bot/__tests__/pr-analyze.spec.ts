import { parsePr, prAnalyze } from '../pr-analyze';

describe('parsePr', () => {
  it('should parse raw PR data', () => {
    expect(
      parsePr({
        logOutput: 'a\nb\n',
        diffOutput: '',
        diffNamesOutput: 'dir/file1\nfile2\n',
        dockerfilesOutput: './docker/foo/Dockerfile\n./docker/bar/baz/Dockerfile\n',
        projectPackagesOutput: './pkg/foo/package.json\n./pkg/bar/baz/package.json\n',
      }),
    ).toEqual({
      dockerfiles: ['docker/foo', 'docker/bar/baz'],
      projectPackages: ['pkg/foo', 'pkg/bar/baz'],
      chanegdFiles: ['dir/file1', 'file2'],
      changes: [],
      commits: ['a', 'b'],
    });
  });
});

describe('prAnalyze', () => {
  const c = (f: string) => ({
    dockerfiles: [],
    projectPackages: [],
    chanegdFiles: [f],
    changes: [],
    commits: [],
  });

  it('should analyze conventional commits', () => {
    expect(
      prAnalyze({
        dockerfiles: [],
        projectPackages: [],
        chanegdFiles: [],
        changes: [],
        commits: ['feat: foo'],
      }).sort(),
    ).toEqual(['diff/XS', 'feat'].sort());
    expect(
      prAnalyze({
        dockerfiles: [],
        projectPackages: [],
        chanegdFiles: [],
        changes: [],
        commits: ['fix: foo', 'chore: foo', 'docs(some): foo', 'foo', 'refactor(some/other): foo', 'test: foo'],
      }).sort(),
    ).toEqual(['diff/XS', 'bug', 'documentation', 'refactor', 'test'].sort());
  });

  it('should analyze diff size', () => {
    expect(
      prAnalyze({
        dockerfiles: [],
        projectPackages: [],
        chanegdFiles: [],
        changes: [
          ...Array(1)
            .fill(0)
            .map(() => ({ type: 'add' as const, content: 'foo' })),
        ],
        commits: [],
      }).sort(),
    ).toEqual(['diff/XS'].sort());
    expect(
      prAnalyze({
        dockerfiles: [],
        projectPackages: [],
        chanegdFiles: [],
        changes: [
          ...Array(10)
            .fill(0)
            .map(() => ({ type: 'add' as const, content: 'foo' })),
        ],
        commits: [],
      }).sort(),
    ).toEqual(['diff/XS'].sort());
    expect(
      prAnalyze({
        dockerfiles: [],
        projectPackages: [],
        chanegdFiles: [],
        changes: [
          ...Array(11)
            .fill(0)
            .map(() => ({ type: 'add' as const, content: 'foo' })),
        ],
        commits: [],
      }).sort(),
    ).toEqual(['diff/S'].sort());
    expect(
      prAnalyze({
        dockerfiles: [],
        projectPackages: [],
        chanegdFiles: [],
        changes: [
          ...Array(60)
            .fill(0)
            .map(() => ({ type: 'add' as const, content: 'foo' })),
        ],
        commits: [],
      }).sort(),
    ).toEqual(['diff/S'].sort());
    expect(
      prAnalyze({
        dockerfiles: [],
        projectPackages: [],
        chanegdFiles: [],
        changes: [
          ...Array(61)
            .fill(0)
            .map(() => ({ type: 'add' as const, content: 'foo' })),
        ],
        commits: [],
      }).sort(),
    ).toEqual(['diff/M'].sort());
    expect(
      prAnalyze({
        dockerfiles: [],
        projectPackages: [],
        chanegdFiles: [],
        changes: [
          ...Array(61)
            .fill(0)
            .map(() => ({ type: 'add' as const, content: 'foo' })),
        ],
        commits: [],
      }).sort(),
    ).toEqual(['diff/M'].sort());
    expect(
      prAnalyze({
        dockerfiles: [],
        projectPackages: [],
        chanegdFiles: [],
        changes: [
          ...Array(300)
            .fill(0)
            .map(() => ({ type: 'add' as const, content: 'foo' })),
        ],
        commits: [],
      }).sort(),
    ).toEqual(['diff/M'].sort());
    expect(
      prAnalyze({
        dockerfiles: [],
        projectPackages: [],
        chanegdFiles: [],
        changes: [
          ...Array(301)
            .fill(0)
            .map(() => ({ type: 'add' as const, content: 'foo' })),
        ],
        commits: [],
      }).sort(),
    ).toEqual(['diff/L'].sort());
    expect(
      prAnalyze({
        dockerfiles: [],
        projectPackages: [],
        chanegdFiles: [],
        changes: [
          ...Array(1000)
            .fill(0)
            .map(() => ({ type: 'add' as const, content: 'foo' })),
        ],
        commits: [],
      }).sort(),
    ).toEqual(['diff/L'].sort());
    expect(
      prAnalyze({
        dockerfiles: [],
        projectPackages: [],
        chanegdFiles: [],
        changes: [
          ...Array(1001)
            .fill(0)
            .map(() => ({ type: 'add' as const, content: 'foo' })),
        ],
        commits: [],
      }).sort(),
    ).toEqual(['diff/XL'].sort());
    expect(
      prAnalyze({
        dockerfiles: [],
        projectPackages: [],
        chanegdFiles: [],
        changes: [
          ...Array(3000)
            .fill(0)
            .map(() => ({ type: 'add' as const, content: 'foo' })),
        ],
        commits: [],
      }).sort(),
    ).toEqual(['diff/XL'].sort());
    expect(
      prAnalyze({
        dockerfiles: [],
        projectPackages: [],
        chanegdFiles: [],
        changes: [
          ...Array(3001)
            .fill(0)
            .map(() => ({ type: 'add' as const, content: 'foo' })),
        ],
        commits: [],
      }).sort(),
    ).toEqual(['diff/XXL'].sort());

    expect(
      prAnalyze({
        dockerfiles: [],
        projectPackages: [],
        chanegdFiles: [],
        changes: [
          ...Array(100)
            .fill(0)
            .map(() => ({ type: 'add' as const, content: '' })),
          ...Array(100)
            .fill(0)
            .map(() => ({ type: 'add' as const, content: '  ' })),
          ...Array(1)
            .fill(0)
            .map(() => ({ type: 'add' as const, content: 'foo' })),
        ],
        commits: [],
      }).sort(),
    ).toEqual(['diff/XS'].sort());

    expect(
      prAnalyze({
        dockerfiles: [],
        projectPackages: [],
        chanegdFiles: [],
        changes: [
          ...Array(100)
            .fill(0)
            .map(() => ({ type: 'add' as const, content: '' })),
          ...Array(100)
            .fill(0)
            .map(() => ({ type: 'add' as const, content: '  ' })),
          ...Array(1)
            .fill(0)
            .map(() => ({ type: 'add' as const, content: 'foo' })),
        ],
        commits: [],
      }).sort(),
    ).toEqual(['diff/XS'].sort());
  });

  it('should analyze TODO comments', () => {
    expect(
      prAnalyze({
        dockerfiles: [],
        projectPackages: [],
        chanegdFiles: [],
        changes: [{ type: 'add' as const, content: '// TODO: foo' }],
        commits: [],
      }).sort(),
    ).toEqual(['diff/XS', 'add/TODO'].sort());
    expect(
      prAnalyze({
        dockerfiles: [],
        projectPackages: [],
        chanegdFiles: [],
        changes: [{ type: 'del' as const, content: '// TODO: foo' }],
        commits: [],
      }).sort(),
    ).toEqual(['diff/XS'].sort());
    expect(
      prAnalyze({
        dockerfiles: [],
        projectPackages: [],
        chanegdFiles: [],
        changes: [{ type: 'normal' as const, content: '// TODO: foo' }],
        commits: [],
      }).sort(),
    ).toEqual(['diff/XS'].sort());
    expect(
      prAnalyze({
        dockerfiles: [],
        projectPackages: [],
        chanegdFiles: [],
        changes: [{ type: 'add' as const, content: '// TODO(some): foo' }],
        commits: [],
      }).sort(),
    ).toEqual(['diff/XS', 'add/TODO'].sort());
    expect(
      prAnalyze({
        dockerfiles: [],
        projectPackages: [],
        chanegdFiles: [],
        changes: [{ type: 'add' as const, content: '"TODO",' }],
        commits: [],
      }).sort(),
    ).toEqual(['diff/XS'].sort());
  });

  it('should analyze project level updates', () => {
    expect(
      prAnalyze({
        dockerfiles: [],
        projectPackages: ['pkg/foo'],
        chanegdFiles: ['pkg/foo/a'],
        changes: [],
        commits: [],
      }).sort(),
    ).toEqual(['diff/XS', 'pkg/foo'].sort());
    expect(
      prAnalyze({
        dockerfiles: [],
        projectPackages: ['pkg/foobar', 'pkg/foo/bar'],
        chanegdFiles: ['pkg/foo/a'],
        changes: [],
        commits: [],
      }).sort(),
    ).toEqual(['diff/XS'].sort());
    expect(
      prAnalyze({
        dockerfiles: [],
        projectPackages: ['pkg/foobar', 'pkg/foo/bar'],
        chanegdFiles: ['pkg/foo/bar/a'],
        changes: [],
        commits: [],
      }).sort(),
    ).toEqual(['diff/XS', 'pkg/foo/bar'].sort());
  });

  it('should analyze docker level updates', () => {
    expect(
      prAnalyze({
        dockerfiles: ['docker/foo'],
        projectPackages: [],
        chanegdFiles: ['docker/foo/a'],
        changes: [],
        commits: [],
      }).sort(),
    ).toEqual(['diff/XS', 'docker/foo'].sort());
    expect(
      prAnalyze({
        dockerfiles: ['docker/foo/bar', 'docker/foobar'],
        projectPackages: [],
        chanegdFiles: ['docker/foo/bar/a'],
        changes: [],
        commits: [],
      }).sort(),
    ).toEqual(['diff/XS', 'docker/foo/bar'].sort());
  });

  it('should analyze test relevant updates', () => {
    expect(prAnalyze(c('foo/bar.spec.ts')).sort()).toEqual(['diff/XS', 'test'].sort());
    expect(prAnalyze(c('foo/bar.test.ts')).sort()).toEqual(['diff/XS', 'test'].sort());
    expect(prAnalyze(c('foo/test/bar.ts')).sort()).toEqual(['diff/XS', 'test'].sort());
    expect(prAnalyze(c('foo/tests/bar.ts')).sort()).toEqual(['diff/XS', 'test'].sort());
    expect(prAnalyze(c('foo/__test__/bar.ts')).sort()).toEqual(['diff/XS', 'test'].sort());
    expect(prAnalyze(c('foo/__tests__/bar.ts')).sort()).toEqual(['diff/XS', 'test'].sort());
  });

  it('should analyze prisma updates', () => {
    expect(prAnalyze(c('foo/prisma/seed.ts')).sort()).toEqual(['diff/XS', 'prisma'].sort());
    expect(prAnalyze(c('foo/prisma/schema.prisma')).sort()).toEqual(['diff/XS', 'prisma', 'prisma/schema'].sort());
    expect(prAnalyze(c('foo/prisma/migrations/foo/bar')).sort()).toEqual(
      ['diff/XS', 'prisma', 'prisma/migrations'].sort(),
    );
  });

  it('should analyze update', () => {
    expect(prAnalyze(c('.eslintrc.js')).sort()).toEqual(['diff/XS', 'rule'].sort());
    expect(prAnalyze(c('.eslintrc.cjs')).sort()).toEqual(['diff/XS', 'rule'].sort());
    expect(prAnalyze(c('.prettierrc')).sort()).toEqual(['diff/XS', 'rule'].sort());
    expect(prAnalyze(c('.eslintignore')).sort()).toEqual(['diff/XS', 'rule'].sort());
    expect(prAnalyze(c('.stylelintignore')).sort()).toEqual(['diff/XS', 'rule'].sort());
    expect(prAnalyze(c('commitlint.config.js')).sort()).toEqual(['diff/XS', 'rule'].sort());
    expect(prAnalyze(c('commitlint.config.cjs')).sort()).toEqual(['diff/XS', 'rule'].sort());
    expect(prAnalyze(c('.npmrc')).sort()).toEqual(['diff/XS', 'rule'].sort());

    expect(prAnalyze(c('pnpm-lock.yaml')).sort()).toEqual(['diff/XS', 'update/lockfile'].sort());
    expect(prAnalyze(c('.github/ISSUE_TEMPLATE/foo.md')).sort()).toEqual(['diff/XS', 'rule'].sort());
    expect(prAnalyze(c('.github/workflows/ci.yml')).sort()).toEqual(['diff/XS', 'rule', 'update/ci'].sort());
    expect(prAnalyze(c('CODEOWNERS')).sort()).toEqual(['diff/XS', 'update/codeowners'].sort());
    expect(prAnalyze(c('.gitignore')).sort()).toEqual(['diff/XS', 'update/gitignore'].sort());
    expect(prAnalyze(c('.dockerignore')).sort()).toEqual(['diff/XS', 'update/dockerignore'].sort());
  });

  it('should analyze invalid update', () => {
    expect(prAnalyze(c('package-lock.json')).sort()).toEqual(['diff/XS', 'invalid/package-lock'].sort());
    expect(prAnalyze(c('yarn.lock')).sort()).toEqual(['diff/XS', 'invalid/yarn-lock'].sort());
  });
});
