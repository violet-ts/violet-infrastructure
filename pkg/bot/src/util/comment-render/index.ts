import type { Temporal } from '@js-temporal/polyfill';
import prettyBytes from 'pretty-bytes';
import type { CommentBody, CommentHint } from '../../type/cmd';

export const renderTimestamp = (instant: Temporal.Instant): string => {
  return `[${instant.toString()}](https://www.timeanddate.com/worldclock/fixedtime.html?iso=${instant.toString()})`;
};

// TODO(hardcoded): i18n
export const renderDuration = (duration: Temporal.Duration): string => {
  const balancedDuration = duration.round({ largestUnit: 'year', smallestUnit: 'milliseconds' });
  const parts: string[] = [];
  if (balancedDuration.years > 0) parts.push(`${`000${balancedDuration.years}`.slice(-4)} y`);
  if (parts.length || balancedDuration.months > 0) parts.push(`${`0${balancedDuration.months}`.slice(-2)} mo`);
  if (parts.length || balancedDuration.days > 0) parts.push(`${`0${balancedDuration.days}`.slice(-2)} d`);
  if (parts.length || balancedDuration.hours > 0) parts.push(`${`0${balancedDuration.hours}`.slice(-2)} h`);
  if (parts.length || balancedDuration.minutes > 0) parts.push(`${`0${balancedDuration.minutes}`.slice(-2)} m`);
  if (parts.length || balancedDuration.seconds > 0) parts.push(`${`0${balancedDuration.seconds}`.slice(-2)} s`);
  if (parts.length || balancedDuration.milliseconds > 0)
    parts.push(`${`0${balancedDuration.milliseconds}`.slice(-2)} ms`);
  return parts.slice(0, 2).join(' ');
};

export const renderBytes = (bytes: number): string => {
  return `<span title="${bytes}">${prettyBytes(bytes)}</span>`;
};

export const renderCommentBody = (body: CommentBody): string => {
  const mode = body.mode ?? 'plain';
  return [
    ...body.main.filter((e) => typeof e === 'string'),
    { ul: '<ul>', ol: '<ol>', plain: '', 'li-only': '' }[mode],
    ...(body.hints
      ?.filter((e): e is CommentHint => e != null && typeof e === 'object')
      .map((hint) =>
        [
          '',
          { ul: '<li>', ol: '<li>', plain: '', 'li-only': '<li>' }[mode],
          '',
          `<details><summary>${hint.title}</summary>`,
          '',
          '',
          `${renderCommentBody(hint.body)}`,
          '',
          '',
          `</details>`,
          '',
          { ul: '</li>', ol: '</li>', plain: '', 'li-only': '</li>' }[mode],
          '',
        ].join('\n'),
      ) ?? []),
    { ul: '<ul>', ol: '<ol>', plain: '', 'li-only': '' }[mode],
  ].join('\n');
};
