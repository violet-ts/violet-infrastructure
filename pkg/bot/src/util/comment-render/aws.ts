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
  return `[\`${imageDigest}\`](https://${imageRegion}.console.aws.amazon.com/ecr/repositories/${imageRepoName}/image/${imageDigest}/details/)`;
};
