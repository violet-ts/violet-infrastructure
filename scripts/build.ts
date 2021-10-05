import * as path from 'path';
import { build } from 'esbuild';
import type { WatchMode } from 'esbuild';
import { nodeExternalsPlugin } from 'esbuild-node-externals';

const root = path.resolve(__dirname, '..');

const main = async (toWatch: boolean) => {
  let watch: boolean | WatchMode = false;
  if (toWatch) {
    console.log('watching...');
    watch = {
      onRebuild(err) {
        if (err) {
          console.error('watch build failed:', err);
        } else {
          console.log('watch build succeeded');
        }
      },
    };
  }
  await build({
    platform: 'node',
    format: 'cjs',
    target: 'es2020',
    bundle: true,
    outdir: 'build',
    entryPoints: [path.resolve(root, 'src/entry/manager.js'), path.resolve(root, 'src/entry/env.js')],
    watch,
    plugins: [nodeExternalsPlugin()],
  });
};

main(process.argv.includes('--watch')).catch((e) => {
  console.error(e);
});
