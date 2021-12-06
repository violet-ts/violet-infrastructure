import { renderAnchor, renderCode, renderWebContentBytes } from '@self/bot/src/util/comment-render';
import type { NextBuildFirstLoad, NextBuildPage, NextBuildSummary } from '@self/bot/src/util/next-build-summary/parse';

export const renderNextBuildSummary = (summary: NextBuildSummary): string => {
  // TODO(hardcoded): i18n
  const footerBody = [
    [
      'λ',
      renderAnchor('Server', 'https://nextjs.org/docs/basic-features/pages#server-side-rendering'),
      `実行時にサーバーサイドでレンダリング (${renderAnchor(
        renderCode('getInitialProps'),
        'https://nextjs.org/docs/api-reference/data-fetching/getInitialProps',
      )} か ${renderAnchor(
        renderCode('getServerSideProps'),
        'https://nextjs.org/docs/basic-features/data-fetching#getserversideprops-server-side-rendering',
      )} を使っている)`,
    ],
    [
      '○ ',
      renderAnchor('Static', 'https://nextjs.org/docs/basic-features/pages#static-generation-without-data'),
      '静的 HTML として自動でレンダリング (初期 props なし)',
    ],
    [
      '● ',
      renderAnchor('SSG', 'https://nextjs.org/docs/basic-features/pages#static-generation-with-data'),
      `静的 HTML + JSON として自動でレンダリング (${renderAnchor(
        renderCode('getStaticProps'),
        'https://nextjs.org/docs/basic-features/data-fetching#getstaticprops-static-generation',
      )} を使っている)`,
    ],
    [
      ' ',
      renderAnchor('ISR', 'https://nextjs.org/docs/basic-features/data-fetching#incremental-static-regeneration'),
      `Incremental Static Regeneration (${renderAnchor(
        renderCode('getStaticProps'),
        'https://nextjs.org/docs/basic-features/data-fetching#getstaticprops-static-generation',
      )} の中で revalidate を使っている)`,
    ],
    // ['λ', 'Server', 'server-side renders at runtime (uses getInitialProps or getServerSideProps)'],
    // ['○ ', 'Static', 'automatically rendered as static HTML (uses no initial props)'],
    // ['● ', 'SSG', 'automatically generated as static HTML + JSON (uses getStaticProps)'],
    // [' ', 'ISR', 'incremental static regeneration (uses revalidate in getStaticProps)'],
  ]
    .map((e) => `<tr>${e.map((td) => `<td>${td}</td>`).join('')}</tr>`)
    .join('');
  const footer = `<table><tbody>${footerBody}</tbody></table>`;
  return [
    '<h1>Next.js ビルドサマリー</h1>',
    renderNextBuildPages(summary.pages),
    '<h2>全ページ共通の初期ロードJS</h2>',
    renderNextBuildFirstLoads(summary.firstLoads),
    '<hr />',
    footer,
  ].join('\n\n');
};

export const renderNextBuildPages = (pages: readonly NextBuildPage[]): string => {
  const tbody = pages
    .flatMap((page) => [
      `<tr>`,
      `<td>${page.rawType}</td>`,
      `<td>${renderCode(page.path)}</td>`,
      `<td>${renderWebContentBytes(page.sizeInBytes)}</td>`,
      `<td>${renderWebContentBytes(page.firstLoadInBytes)}</td>`,
      `</tr>`,
    ])
    .join('');
  return `<table><thead><tr><th></th><th>パス</th><th>サイズ</th><th>初期ロードJS</th></tr></thead><tbody>${tbody}</tbody></table>`;
};

export const renderNextBuildFirstLoads = (firstLoads: readonly NextBuildFirstLoad[]): string => {
  const tbody = firstLoads
    .flatMap((page) => [
      `<tr>`,
      `<td>${renderCode(page.path)}</td>`,
      `<td>${renderWebContentBytes(page.sizeInBytes)}</td>`,
      `</tr>`,
    ])
    .join('');
  return `<table><thead><tr><th>ファイル名</th><th>サイズ</th></tr></thead><tbody>${tbody}</tbody></table>`;
};
