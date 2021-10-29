import * as path from 'path';
import { build } from 'esbuild';
import * as fg from 'fast-glob';
import * as fs from 'fs';
import * as Queue from 'promise-queue';
import * as chokidar from 'chokidar';
import * as arg from 'arg';

const sharedRootDir = path.resolve(__dirname, '..');
const libDir = path.resolve(sharedRootDir, 'lib');

const queue = new Queue(1, 1);

const changedFiles = new Set<string>();

const jsOf = (p: string) => {
  const { dir, name } = path.parse(p);
  return path.join(dir, `${name}.js`);
};

const runBuildMain = async (): Promise<void> => {
  console.log(`building ${changedFiles.size} file(s)...`);
  const promises = [...changedFiles].map(async (entry) => {
    const outfile = jsOf(entry);
    await build({
      platform: 'node',
      format: 'cjs',
      // NOTE: CodeBuild の node14.x ランタイムを使用
      target: 'node14',
      minify: true,
      sourcemap: 'inline',
      keepNames: true,
      outfile,
      entryPoints: [entry],
    });
  });
  changedFiles.clear();
  await Promise.all(promises);

  console.log('build done');
};
const queueBuild = (): void => {
  if (queue.getQueueLength() === 0) {
    queue.add(runBuildMain).catch((e) => {
      console.error(e);
    });
  }
};

interface Params {
  watch: boolean;
  clean: boolean;
  shouldClean: boolean;
}
const main = async (params: Params) => {
  const cleanUp = async (should: boolean) => {
    const jsRelPath = await fg('**/*.js', { cwd: libDir });
    await Promise.all(
      jsRelPath
        .map((jsRelPath) => path.resolve(libDir, jsRelPath))
        .map(async (jsFile) => {
          let prom = fs.promises.rm(jsFile);
          if (!should)
            prom = prom.catch((e) => {
              console.warn(`Failed to clean ${jsFile}.`, e);
            });
          await prom;
        }),
    );
  };
  if (params.clean) await cleanUp(params.shouldClean);
  const entries = await fg('**/*.ts', { cwd: libDir });
  entries.forEach((e) => changedFiles.add(path.resolve(libDir, e)));
  if (params.watch) {
    console.log('watching...');
    chokidar
      .watch('**/*.ts', {
        cwd: libDir,
      })
      .on('all', (event, relPath) => {
        const absPath = path.resolve(libDir, relPath);
        const jsPath = jsOf(absPath);
        switch (event) {
          case 'add':
          case 'change':
            changedFiles.add(absPath);
            queueBuild();
            break;
          case 'unlink':
            console.log(`deleting ${jsPath}`);
            void (async () => {
              if (!fs.existsSync(jsPath)) return;
              await fs.promises.rm(jsPath).catch((e) => {
                console.warn('Failed to remove.', e);
              });
            })();
            break;
          default:
            break;
        }
      });
  } else {
    await runBuildMain();
  }
};

const args = arg({
  '--watch': Boolean,
  '--clean': Boolean,
  '--should-clean': Boolean,
});

main({
  watch: Boolean(args['--watch']),
  clean: Boolean(args['--clean']),
  shouldClean: Boolean(args['--should-clean']),
}).catch((e) => {
  console.error(e);
});
