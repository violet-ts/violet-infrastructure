export interface RenderGitHubPRCommitParams {
  owner: string;
  repo: string;
  prNumber: number;
  rev: string;
}
export const renderGitHubPRCommit = ({ rev, repo, owner, prNumber }: RenderGitHubPRCommitParams): string => {
  return `[\`${owner}/${repo}#${prNumber}@${rev.slice(
    0,
    6,
  )}\`](https://github.com/${owner}/${repo}/pull/${prNumber}/commits/${rev})`;
};

export interface RenderGitHubCommit {
  owner: string;
  repo: string;
  rev: string;
}
export const renderGitHubCommit = ({ rev, repo, owner }: RenderGitHubCommit): string => {
  return `[\`${owner}/${repo}@${rev.slice(0, 6)}\`](https://github.com/${owner}/${repo}/tree/${rev})`;
};
