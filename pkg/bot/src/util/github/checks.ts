import fetch from 'node-fetch';

export interface GetCheckPullNumberParams {
  owner: string;
  repo: string;
  runId: number;
}
export const getCheckPullNumber = async ({ repo, owner, runId }: GetCheckPullNumberParams): Promise<number> => {
  const url = `https://github.com/${owner}/${repo}/actions/runs/${runId}`;
  const res = await fetch(url);
  const text = await res.text();
  const matches = text.match(new RegExp(`href="/${owner}/${repo}/pull/(\\d+)"`));
  if (matches == null) throw new Error(`pull number not found for check ${url}`);
  return Number.parseInt(matches[1], 10);
};
