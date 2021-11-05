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
        commits: ['fix: foo', 'chore: foo', 'docs(some): foo', 'foo', 'refactor(some/other): foo'],
      }).sort(),
    ).toEqual(['diff/XS', 'bug', 'documentation', 'refactor'].sort());
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
});
