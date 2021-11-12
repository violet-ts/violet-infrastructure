import * as childProcess from 'child_process';
import * as chokidar from 'chokidar';
import { build } from 'esbuild';
import * as fs from 'fs';
import * as path from 'path';
import Queue from 'promise-queue';
import * as util from 'util';

const execFile = util.promisify(childProcess.execFile);

const botRootDir = path.resolve(__dirname, '..');
const buildDir = path.resolve(botRootDir, 'build');
const entryDir = path.resolve(botRootDir, 'src', 'entry', 'lambda');

const queue = new Queue(1, 1);

const runBuildMain = async (): Promise<void> => {
  console.log('building...');
  const lambdaEntries = await fs.promises.readdir(entryDir);
  const lambdaNames = lambdaEntries.map((entry) => path.parse(entry).name);
  const lambdaPaths = lambdaEntries.map((entry) => path.resolve(entryDir, entry));

  await build({
    platform: 'node',
    format: 'cjs',
    // NOTE: Lambda の node14.x ランタイムを使用
    target: 'node14',
    minify: true,
    sourcemap: 'inline',
    bundle: true,
    outdir: buildDir,
    entryPoints: lambdaPaths,
  });

  await Promise.all(
    lambdaNames.map(async (entry) => {
      const zipPath = path.resolve(buildDir, `${entry}.zip`);
      await fs.promises.rm(zipPath).catch((e) => {
        if (!e.message.match(/no such file or directory/)) throw e;
      });
      await execFile('zip', [zipPath, `${entry}.js`], { cwd: buildDir });
    }),
  );
  console.log('build done');
};
const queueBuild = (): void => {
  if (queue.getQueueLength() === 0) {
    queue.add(runBuildMain).catch((e) => {
      console.error(e);
    });
  }
};

const main = async (watch: boolean) => {
  if (watch) {
    console.log('watching...');
    chokidar
      .watch('**/*.ts', {
        cwd: path.resolve(botRootDir, 'src'),
      })
      .on('all', () => {
        queueBuild();
      });
  } else {
    await runBuildMain();
  }
};

main(process.argv.includes('--watch')).catch((e) => {
  console.error(e);
});
