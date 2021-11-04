import { ECR } from '@aws-sdk/client-ecr';
import type { Credentials, Provider } from '@aws-sdk/types';
import type { Logger } from 'winston';
import { z } from 'zod';

interface GetImageDetailByTagParams {
  imageRegion: string;
  imageRepoName: string;
  imageTag: string;
}
interface ImageDetail {
  imageRegion: string;
  imageRepoName: string;
  imageDigest: string;
  imageSizeInBytes: number;
}
export const getImageDetailByTag = async (
  params: GetImageDetailByTagParams,
  credentials: Credentials | Provider<Credentials>,
  logger: Logger,
): Promise<ImageDetail | null> => {
  const ecr = new ECR({ credentials, logger, region: params.imageRegion });
  let nextToken: string | undefined;
  do {
    // eslint-disable-next-line no-await-in-loop -- sequential
    const page = await ecr.describeImages({
      repositoryName: params.imageRepoName,
      filter: { tagStatus: 'TAGGED' },
    });
    nextToken = page.nextToken;
    if (page.imageDetails == null) throw new Error('imageDetails is undefined');
    const found = page.imageDetails.find((imageDetail) => imageDetail.imageTags?.includes(params.imageTag));
    if (found != null)
      return {
        imageRegion: params.imageRegion,
        imageRepoName: params.imageRepoName,
        imageDigest: z.string().parse(found.imageDigest),
        imageSizeInBytes: z.number().parse(found.imageSizeInBytes),
      };
  } while (typeof nextToken === 'string');
  return null;
};
