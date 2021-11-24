import {
  parseActionsOutput,
  parseNextBuildFirstLoadLine,
  parseNextBuildOutput,
  parseNextBuildPageLine,
} from '../parse';

describe('parseNextBuildOutput', () => {
  it('should parse next build output', () => {
    expect(
      parseNextBuildOutput([
        'Page                             Size     First Load JS',
        '┌ ○ /                            3.71 kB         211 kB',
        '├   /_app                        0 B            88.5 kB',
        '├ ○ /404                         190 B          88.7 kB',
        '├ ○ /browser/[...pathes]         14.5 kB         103 kB',
        '├ ○ /dev                         1.89 kB        90.4 kB',
        '├ ○ /dev/auth                    2 kB           90.6 kB',
        '├ ○ /dev/auth/private-comment    4.28 kB         212 kB',
        '└ ○ /dev/auth/public-comment     4.31 kB         212 kB',
        '+ First Load JS shared by all    88.5 kB',
        '  ├ chunks/main.0e0793.js        64.6 kB',
        '  ├ chunks/pages/_app.74a166.js  23 kB',
        '  └ chunks/webpack.a7ee49.js     880 B',
        'λ  (Server)  server-side renders at runtime (uses getInitialProps or getServerSideProps)',
        '○  (Static)  automatically rendered as static HTML (uses no initial props)',
        '●  (SSG)     automatically generated as static HTML + JSON (uses getStaticProps)',
        '   (ISR)     incremental static regeneration (uses revalidate in getStaticProps)',
      ]),
    ).toEqual({
      firstLoads: [
        {
          path: 'chunks/main.0e0793.js',
          sizeInBytes: 64600,
        },
        {
          path: 'chunks/pages/_app.74a166.js',
          sizeInBytes: 23000,
        },
        {
          path: 'chunks/webpack.a7ee49.js',
          sizeInBytes: 880,
        },
      ],
      pages: [
        {
          firstLoadInBytes: 211000,
          path: '/',
          rawType: '○',
          sizeInBytes: 3710,
          type: 'Static',
        },
        {
          firstLoadInBytes: 88500,
          path: '/_app',
          rawType: ' ',
          sizeInBytes: 0,
          type: 'ISR',
        },
        {
          firstLoadInBytes: 88700,
          path: '/404',
          rawType: '○',
          sizeInBytes: 190,
          type: 'Static',
        },
        {
          firstLoadInBytes: 103000,
          path: '/browser/[...pathes]',
          rawType: '○',
          sizeInBytes: 14500,
          type: 'Static',
        },
        {
          firstLoadInBytes: 90400,
          path: '/dev',
          rawType: '○',
          sizeInBytes: 1890,
          type: 'Static',
        },
        {
          firstLoadInBytes: 90600,
          path: '/dev/auth',
          rawType: '○',
          sizeInBytes: 2000,
          type: 'Static',
        },
        {
          firstLoadInBytes: 212000,
          path: '/dev/auth/private-comment',
          rawType: '○',
          sizeInBytes: 4280,
          type: 'Static',
        },
        {
          firstLoadInBytes: 212000,
          path: '/dev/auth/public-comment',
          rawType: '○',
          sizeInBytes: 4310,
          type: 'Static',
        },
      ],
    });
  });
});

describe('parseNextBuildPageLine', () => {
  it('should parse next build page line', () => {
    expect(parseNextBuildPageLine('┌ ○ /                            3.71 kB         211 kB')).toEqual({
      path: '/',
      rawType: '○',
      type: 'Static',
      sizeInBytes: 3710,
      firstLoadInBytes: 211000,
    });
    expect(parseNextBuildPageLine('├   /_app                        0 B            88.5 kB')).toEqual({
      path: '/_app',
      rawType: ' ',
      type: 'ISR',
      sizeInBytes: 0,
      firstLoadInBytes: 88500,
    });
    expect(parseNextBuildPageLine('├ ○ /404                         190 B          88.7 kB')).toEqual({
      path: '/404',
      rawType: '○',
      type: 'Static',
      sizeInBytes: 190,
      firstLoadInBytes: 88700,
    });
    expect(parseNextBuildPageLine('├ ○ /browser/[...pathes]         14.5 kB         103 kB')).toEqual({
      path: '/browser/[...pathes]',
      rawType: '○',
      type: 'Static',
      sizeInBytes: 14500,
      firstLoadInBytes: 103000,
    });
    expect(parseNextBuildPageLine('├ λ /foo  bar         14.5 kB         103 MB')).toEqual({
      path: '/foo  bar',
      rawType: 'λ',
      type: 'Server',
      sizeInBytes: 14500,
      firstLoadInBytes: 103000000,
    });
  });
});

describe('parseNextBuildFirstLoadLine', () => {
  it('should parse next build first load line', () => {
    expect(parseNextBuildFirstLoadLine('  ├ chunks/main.0e0793.js        64.6 kB')).toEqual({
      path: 'chunks/main.0e0793.js',
      sizeInBytes: 64600,
    });
  });
});

describe('parseActionsOutput', () => {
  it('should parse actions output', () => {
    expect(
      parseActionsOutput([
        '2021-11-23T18:50:19.4060450Z pkg/api _:build: [_:build:entries -- --prod     ] > ts-node -T ./node_modules/@violet/scripts/build-files.ts --from-dir=./src/entries --to-dir=./build --target=node14 "--prod"',
        '2021-11-23T18:50:19.4062060Z pkg/api _:build: [_:build:entries -- --prod     ] ',
        '2021-11-23T18:50:19.5656482Z pkg/lambda/conv2img _:build: Done',
        '2021-11-23T18:50:20.8478384Z pkg/api _:build: Done',
        '2021-11-23T18:50:20.8485830Z pkg/web _:build$ next build',
        '2021-11-23T18:50:21.8395152Z pkg/web _:build: info  - Using webpack 5. Reason: Enabled by default https://nextjs.org/docs/messages/webpack5',
        '2021-11-23T18:50:22.0581399Z pkg/web _:build: warn  - No build cache found. Please configure build caching for faster rebuilds. Read more: https://nextjs.org/docs/messages/no-cache',
        '2021-11-23T18:50:22.0767022Z pkg/web _:build: Attention: Next.js now collects completely anonymous telemetry regarding usage.',
        "2021-11-23T18:50:22.0770162Z pkg/web _:build: This information is used to shape Next.js' roadmap and prioritize features.",
        "2021-11-23T18:50:22.0772510Z pkg/web _:build: You can learn more, including how to opt-out if you'd not like to participate in this anonymous program, by visiting the following URL:",
        '2021-11-23T18:50:22.0774171Z pkg/web _:build: https://nextjs.org/telemetry',
        '2021-11-23T18:50:22.2511919Z pkg/web _:build: info  - Checking validity of types...',
        '2021-11-23T18:50:31.1397682Z pkg/web _:build: warn  - The Next.js plugin was not detected in your ESLint configuration. See https://nextjs.org/docs/basic-features/eslint#migrating-existing-config',
        '2021-11-23T18:50:32.4817737Z pkg/web _:build: info  - Creating an optimized production build...',
        '2021-11-23T18:50:33.3808705Z pkg/web _:build: info  - Using external babel configuration from /home/runner/work/violet-debug/violet-debug/pkg/web/.babelrc',
        '2021-11-23T18:51:01.6107678Z pkg/web _:build: info  - Compiled successfully',
        '2021-11-23T18:51:01.6109680Z pkg/web _:build: info  - Collecting page data...',
        '2021-11-23T18:51:01.9185060Z pkg/web _:build: info  - Generating static pages (0/8)',
        '2021-11-23T18:51:02.2322483Z pkg/web _:build: info  - Generating static pages (2/8)',
        '2021-11-23T18:51:02.2989269Z pkg/web _:build: info  - Generating static pages (4/8)',
        '2021-11-23T18:51:02.3248471Z pkg/web _:build: info  - Generating static pages (6/8)',
        '2021-11-23T18:51:02.3326324Z pkg/web _:build: info  - Generating static pages (8/8)',
        '2021-11-23T18:51:02.3395067Z pkg/web _:build: info  - Finalizing page optimization...',
        '2021-11-23T18:51:02.3725170Z pkg/web _:build: Page                             Size     First Load JS',
        '2021-11-23T18:51:02.3728297Z pkg/web _:build: ┌ ○ /                            3.71 kB         211 kB',
        '2021-11-23T18:51:02.3729962Z pkg/web _:build: ├   /_app                        0 B            88.5 kB',
        '2021-11-23T18:51:02.3731605Z pkg/web _:build: ├ ○ /404                         190 B          88.7 kB',
        '2021-11-23T18:51:02.3732896Z pkg/web _:build: ├ ○ /browser/[...pathes]         14.5 kB         103 kB',
        '2021-11-23T18:51:02.3734646Z pkg/web _:build: ├ ○ /dev                         1.89 kB        90.4 kB',
        '2021-11-23T18:51:02.3737866Z pkg/web _:build: ├ ○ /dev/auth                    2 kB           90.6 kB',
        '2021-11-23T18:51:02.3739682Z pkg/web _:build: ├ ○ /dev/auth/private-comment    4.28 kB         212 kB',
        '2021-11-23T18:51:02.3740769Z pkg/web _:build: └ ○ /dev/auth/public-comment     4.31 kB         212 kB',
        '2021-11-23T18:51:02.3741550Z pkg/web _:build: + First Load JS shared by all    88.5 kB',
        '2021-11-23T18:51:02.3742475Z pkg/web _:build:   ├ chunks/main.0e0793.js        64.6 kB',
        '2021-11-23T18:51:02.3743399Z pkg/web _:build:   ├ chunks/pages/_app.74a166.js  23 kB',
        '2021-11-23T18:51:02.3744338Z pkg/web _:build:   └ chunks/webpack.a7ee49.js     880 B',
        '2021-11-23T18:51:02.3746116Z pkg/web _:build: λ  (Server)  server-side renders at runtime (uses getInitialProps or getServerSideProps)',
        '2021-11-23T18:51:02.3747863Z pkg/web _:build: ○  (Static)  automatically rendered as static HTML (uses no initial props)',
        '2021-11-23T18:51:02.3749596Z pkg/web _:build: ●  (SSG)     automatically generated as static HTML + JSON (uses getStaticProps)',
        '2021-11-23T18:51:02.3751727Z pkg/web _:build:    (ISR)     incremental static regeneration (uses revalidate in getStaticProps)',
        '2021-11-23T18:51:02.7350052Z pkg/web _:build: Done',
        '2021-11-23T18:51:02.7582076Z Post job cleanup.',
        '2021-11-23T18:51:02.8702975Z ##[group]Running pnpm store prune...',
        '2021-11-23T18:51:03.3514353Z Removed all cached metadata files',
      ]),
    ).toEqual([
      'Page                             Size     First Load JS',
      '┌ ○ /                            3.71 kB         211 kB',
      '├   /_app                        0 B            88.5 kB',
      '├ ○ /404                         190 B          88.7 kB',
      '├ ○ /browser/[...pathes]         14.5 kB         103 kB',
      '├ ○ /dev                         1.89 kB        90.4 kB',
      '├ ○ /dev/auth                    2 kB           90.6 kB',
      '├ ○ /dev/auth/private-comment    4.28 kB         212 kB',
      '└ ○ /dev/auth/public-comment     4.31 kB         212 kB',
      '+ First Load JS shared by all    88.5 kB',
      '  ├ chunks/main.0e0793.js        64.6 kB',
      '  ├ chunks/pages/_app.74a166.js  23 kB',
      '  └ chunks/webpack.a7ee49.js     880 B',
      'λ  (Server)  server-side renders at runtime (uses getInitialProps or getServerSideProps)',
      '○  (Static)  automatically rendered as static HTML (uses no initial props)',
      '●  (SSG)     automatically generated as static HTML + JSON (uses getStaticProps)',
      '   (ISR)     incremental static regeneration (uses revalidate in getStaticProps)',
    ]);
  });
});
