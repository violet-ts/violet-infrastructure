import arg from 'arg';
import * as childProcess from 'child_process';
import type { Plugin, WatchMode } from 'esbuild';
import { build } from 'esbuild';
import * as fs from 'fs';
import * as path from 'path';
import Queue from 'promise-queue';
import * as util from 'util';

const execFile = util.promisify(childProcess.execFile);

interface Params {
  fromDir: string;
  toDir: string;
  watch: boolean;
  target: string;
  clean: boolean;
}

const omitImportNodeNSPlugin: Plugin = {
  name: 'omit-import-node-ns',
  setup(build) {
    build.onResolve({ filter: /^node:/ }, (args) => {
      return {
        path: args.path.slice(5),
        external: true,
      };
    });
  },
};

const main = async ({ fromDir, toDir, watch, target, clean }: Params) => {
  const queue = new Queue(1, 1);

  const zipEntry = async (entry: string) => {
    const zipPath = path.resolve(toDir, `${entry}.zip`);
    await fs.promises.rm(zipPath).catch((e) => {
      if (e.code !== 'ENOENT') throw e;
    });
    await execFile('zip', [zipPath, `${entry}.js`], { cwd: toDir });
  };

  const entries = await fs.promises.readdir(fromDir);
  const entryNames = entries.map((entry) => path.parse(entry).name);
  const zipAll = async () => {
    return Promise.all(entryNames.map((entry) => zipEntry(entry)));
  };

  const queueZipAll = (): void => {
    if (queue.getQueueLength() === 0) {
      queue.add(zipAll).catch((e) => {
        console.error(e);
      });
    }
  };
  const fromDirAbs = path.resolve(process.cwd(), fromDir);
  const toDirAbs = path.resolve(process.cwd(), toDir);

  const entryPoints = fs
    .readdirSync(fromDirAbs)
    .map((f) => path.resolve(fromDirAbs, f))
    .filter((e) => e.endsWith('.ts'));
  const watchOptions: boolean | WatchMode = watch && {
    onRebuild(error, result) {
      if (error || !result) {
        console.error(error);
        return;
      }
      console.log(`Build done for files under ${fromDirAbs}`);
      queueZipAll();
    },
  };

  const cleanPlugin: Plugin = {
    name: 'clean',
    setup(build) {
      build.onStart(() => {
        try {
          fs.rmSync(toDirAbs, { recursive: true, force: true, maxRetries: 3 });
        } catch (_err: unknown) {
          // ignore error
        }
        fs.mkdirSync(toDirAbs, { recursive: true });
      });
    },
  };

  await build({
    platform: 'node',
    format: 'cjs',
    target,
    minify: true,
    keepNames: true,
    sourcemap: 'inline',
    bundle: true,
    outdir: toDirAbs,
    entryPoints,
    watch: watchOptions,
    plugins: [
      ...(clean ? [cleanPlugin] : []),
      omitImportNodeNSPlugin,
      // nodeExternalsPlugin({
      //   allowList: [],
      // }),
    ],
  });

  await zipAll();
};

const args = arg({
  '--watch': Boolean,
  // NOTE: 現状未使用
  '--prod': Boolean,
  '--from-dir': String,
  '--to-dir': String,
  '--target': String,
  '--clean': Boolean,
});
main({
  watch: Boolean(args['--watch']),
  fromDir: args['--from-dir'] || '',
  toDir: args['--to-dir'] || '',
  target: args['--target'] || '',
  clean: Boolean(args['--clean']),
}).catch((e) => {
  console.error(e);
  process.exit(1);
});
