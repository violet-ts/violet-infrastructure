import { renderAnchor, renderScoreBadge } from '@self/bot/src/util/comment-render';
import { lighthouseNames } from '@self/shared/lib/const/lighthouse';
import type { LighthouseBuildOutput } from '@self/shared/lib/operate-env/build-output';
import { gzipSync } from 'zlib';

export const renderLighthouseScorePercentage = (score: number | null | undefined): string => {
  if (score == null) return 'https://img.shields.io/badge/-N%2FA-grey?style=flat';
  const color = (() => {
    if (score < 0.5) return 'red';
    if (score < 0.9) return 'yellow';
    return 'green';
  })();
  const scorePercentage = Math.round(100 * score);
  const badge = renderScoreBadge(scorePercentage.toString(), color);
  return `<span title="${scorePercentage}">${badge}</span>`;
};

export interface RenderLighthousePathResultsParams {
  buildArtifactBucket: string;
  buildId: string;
  pathResults: Required<LighthouseBuildOutput>['lighthouseBuildOutput']['paths'];
}
export const renderLighthousePathResults = ({
  pathResults,
  buildId,
  buildArtifactBucket,
}: RenderLighthousePathResultsParams): string => {
  const tbody = pathResults
    .flatMap((r) => {
      const htmlReportUrl = `https://${buildArtifactBucket}.s3.amazonaws.com/${buildId}/${r.s3Folder}/${lighthouseNames.html}`;
      return [
        '<tr>',
        `<td>${renderAnchor(
          (r.mode === 'mobile' ? '<span title="mobile">📱</span>' : '<span title="desktop">🖥️</span>') + r.path,
          r.url,
        )}</td>`,
        `<td>${renderAnchor(
          renderLighthouseScorePercentage(r.scores.performance),
          `${htmlReportUrl}#performance`,
        )}</td>`,
        `<td>${renderAnchor(
          renderLighthouseScorePercentage(r.scores.accessibility),
          `${htmlReportUrl}#accessibility`,
        )}</td>`,
        `<td>${renderAnchor(
          renderLighthouseScorePercentage(r.scores['best-practices']),
          `${htmlReportUrl}#best-practices`,
        )}</td>`,
        `<td>${renderAnchor(renderLighthouseScorePercentage(r.scores.seo), `${htmlReportUrl}#seo`)}</td>`,
        '<td>',
        `${renderAnchor('HTML', htmlReportUrl)}`,
        '<br />',
        `${renderAnchor(
          'Treemap',
          `https://googlechrome.github.io/lighthouse/treemap/?gzip=1#${gzipSync(
            Buffer.from(JSON.stringify(r.lhrTreemapJson)),
          ).toString('base64')}`,
        )}`,
        '<br />',
        `${renderAnchor(
          'PageSpeed Insights',
          `https://pagespeed.web.dev/report?url=${encodeURIComponent(r.url)}&hl=JA`,
        )}`,
        '<br />',
        `${renderAnchor(
          'JSON',
          `https://${buildArtifactBucket}.s3.amazonaws.com/${buildId}/${r.s3Folder}/${lighthouseNames.json}`,
        )}`,
        '<br />',
        '</td>',
        '</tr>',
      ];
    })
    .join('');
  return [
    '<table>',
    '<thead>',
    '<tr>',
    '<th>URL</th>',
    '<th>パフォーマンス</th>',
    '<th>アクセシビリティ</th>',
    '<th>ベストプラクティス</th>',
    '<th>SEO</th>',
    '<th>レポート</th>',
    '</tr>',
    '</thead>',
    `<tbody>${tbody}</tbody>`,
    '</table>',
  ].join('');
};
