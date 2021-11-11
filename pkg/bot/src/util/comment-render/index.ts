import type { Temporal } from '@js-temporal/polyfill';
import prettyBytes from 'pretty-bytes';
import type { CmdStatus, CommentBody, CommentHint } from '@self/bot/src/type/cmd';

export const renderTimestamp = (instant: Temporal.Instant): string => {
  return `<a href="https://www.timeanddate.com/worldclock/fixedtime.html?iso=${instant.toString()}">${instant.toString()}</a>`;
};

export const renderPlainDuration = (duration: Temporal.Duration): string => {
  const balancedDuration = duration.round({ largestUnit: 'year', smallestUnit: 'milliseconds' });
  const parts: string[] = [];
  if (balancedDuration.years > 0) parts.push(`${balancedDuration.years} y`);
  if (parts.length || balancedDuration.months > 0) parts.push(`${balancedDuration.months} mo`);
  if (parts.length || balancedDuration.days > 0) parts.push(`${balancedDuration.days} d`);
  if (parts.length || balancedDuration.hours > 0) parts.push(`${`0${balancedDuration.hours}`.slice(-2)} h`);
  if (parts.length || balancedDuration.minutes > 0) parts.push(`${`0${balancedDuration.minutes}`.slice(-2)} m`);
  if (parts.length || balancedDuration.seconds > 0) parts.push(`${`0${balancedDuration.seconds}`.slice(-2)} s`);
  if (parts.length || balancedDuration.milliseconds > 0)
    parts.push(`${`0${balancedDuration.milliseconds}`.slice(-2)} ms`);
  return parts.slice(0, 2).join(' ');
};

export const renderDuration = (duration: Temporal.Duration): string => {
  return `<span title="${duration.total({ unit: 'millisecond' })} ms">${renderPlainDuration(duration)}</span>`;
};

export const renderBytes = (bytes: number): string => {
  return `<span title="${bytes} bytes">${prettyBytes(bytes)}</span>`;
};

const isString = (v: unknown): v is string => typeof v === 'string';

export const renderCommentBody = (body: CommentBody): string => {
  const main = body.main.filter(isString);
  const hints = body.hints?.filter((e): e is CommentHint => e != null && typeof e === 'object') ?? [];
  const mode = body.mode ?? 'plain';
  if (mode === 'plain' && main.length === 1 && hints.length === 0) return main[0];
  return [
    { ul: '<ul>', plain: '' }[mode],
    ...main.map((line) => (mode === 'ul' ? `<li>${line}</li>` : line)),
    ...hints.map((hint) =>
      [
        mode === 'ul' ? '<li>' : '',
        `<details><summary>${hint.title}</summary>`,
        '',
        '',
        `${renderCommentBody(hint.body)}`,
        '',
        '',
        `</details>`,
        mode === 'ul' ? '</li>' : '',
      ].join('\n'),
    ),
    { ul: '<ul>', plain: '' }[mode],
  ].join('\n');
};

export const renderProcessingDuration = (status: CmdStatus, from: Temporal.Instant, to: Temporal.Instant): string => {
  if (status !== 'undone') {
    if (from.equals(to)) return `(${renderTimestamp(from)})`;
    const duration = from.until(to);
    return `<code>${renderDuration(duration)}</code> (${renderTimestamp(from)} ～ ${renderTimestamp(to)})`;
  }
  return `(${renderTimestamp(from)} ～)`;
};

export const renderAnchor = (name: string, href: string): string => {
  // TODO: escape href
  return `<a href="${href}">${name}</a>`;
};

export const renderBold = (content: string): string => {
  return `<b>${content}</b>`;
};

export const renderCode = (code: string): string => {
  return `<code>${code}</code>`;
};
