import type { CommentBody, CommentHint } from '../type/cmd';

export const renderTimestamp = (date: Date): string => {
  return `[${date.toString()}](https://www.timeanddate.com/worldclock/fixedtime.html?iso=${date.toISOString()})`;
};

export const renderCommentBody = (body: CommentBody): string => {
  return [
    ...body.main.filter((e) => typeof e === 'string'),
    ...(body.hints
      ?.filter((e): e is CommentHint => e != null && typeof e === 'object')
      .map((hint) => `<details><summary>${hint.title}</summary>\n\n${renderCommentBody(hint.body)}\n\n</details>`) ??
      []),
  ].join('\n');
};
