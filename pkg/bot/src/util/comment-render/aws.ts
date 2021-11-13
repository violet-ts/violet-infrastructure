import { renderAnchor, renderCode } from '.';

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
    renderAnchor(
      renderCode(imageRepoName),
      `https://${imageRegion}.console.aws.amazon.com/ecr/repositories/${imageRepoName}`,
    ),
    `@${renderAnchor(
      renderCode(imageDigest),
      `https://${imageRegion}.console.aws.amazon.com/ecr/repositories/${imageRepoName}/image/${imageDigest}/details/`,
    )}`,
  ].join('');
};

export interface RenderS3BucketParams {
  bucket: string;
}
export const renderS3Bucket = ({ bucket }: RenderS3BucketParams): string => {
  return renderAnchor(`s3://${bucket}`, `https://s3.console.aws.amazon.com/s3/buckets/${bucket}?tab=objects`);
};

export interface RenderS3ObjectParams {
  bucket: string;
  key: string;
}
export const renderS3Object = ({ bucket, key }: RenderS3ObjectParams): string => {
  return renderAnchor(
    `s3://${bucket}/${key}`,
    `https://s3.console.aws.amazon.com/s3/buckets/${bucket}?prefix=${encodeURIComponent(key).replace(/ /g, '+')}`,
  );
};

export interface RenderLambdaFunctionParams {
  region: string;
  functionName: string;
}
export const renderLambdaFunction = ({ region, functionName }: RenderLambdaFunctionParams): string => {
  return renderAnchor(
    functionName,
    `https://${region}.console.aws.amazon.com/lambda/home#/functions/${functionName}?tab=monitoring`,
  );
};

export interface RenderECSClusterParams {
  region: string;
  clusterName: string;
}
export const renderECSCluster = ({ region, clusterName }: RenderECSClusterParams): string => {
  return renderAnchor(
    clusterName,
    `https://${region}.console.aws.amazon.com/ecs/home#/clusters/${clusterName}/services`,
  );
};
