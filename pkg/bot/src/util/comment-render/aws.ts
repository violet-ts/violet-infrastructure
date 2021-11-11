export interface RenderECRImageDigestParams {
  imageRegion: string;
  imageRepoName: string;
  imageDigest: string;
}
export const renderECRImageDigest = ({
  imageRegion,
  imageRepoName,
  imageDigest,
}: RenderECRImageDigestParams): string => {
  return [
    `<a href="https://${imageRegion}.console.aws.amazon.com/ecr/repositories/${imageRepoName}"><code>${imageRepoName}</code></a>`,
    `@<a href="https://${imageRegion}.console.aws.amazon.com/ecr/repositories/${imageRepoName}/image/${imageDigest}/details/"><code>${imageDigest}</code></a>`,
  ].join('');
};
