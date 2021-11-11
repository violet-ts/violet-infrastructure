export interface RenderGitHubPRCommitParams {
  owner: string;
  repo: string;
  prNumber: number;
  rev: string;
}
export const renderGitHubPRCommit = ({ rev, repo, owner, prNumber }: RenderGitHubPRCommitParams): string => {
  return `<a href="https://github.com/${owner}/${repo}/pull/${prNumber}/commits/${rev}"><code>${owner}/${repo}#${prNumber}@${rev.slice(
    0,
    6,
  )}</code></a>`;
};

export interface RenderGitHubCommit {
  owner: string;
  repo: string;
  rev: string;
}
export const renderGitHubCommit = ({ rev, repo, owner }: RenderGitHubCommit): string => {
  return `<a href="https://github.com/${owner}/${repo}/tree/${rev}"><code>${owner}/${repo}@${rev.slice(
    0,
    6,
  )}</code></a>`;
};
