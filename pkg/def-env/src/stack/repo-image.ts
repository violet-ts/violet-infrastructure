import type { AwsProvider } from '@cdktf/provider-aws';
import { ecr } from '@cdktf/provider-aws';
import type { ResourceConfig } from '@cdktf/provider-null/lib/resource';
import { Resource } from '@cdktf/provider-null/lib/resource';
import type { SharedEnv } from '@self/shared/lib/def/env-vars';
import type { Construct } from 'constructs';
import { z } from 'zod';

export interface HTTPTaskOptions {
  sharedEnv: SharedEnv;
  aws: AwsProvider;

  repoName: string;
  imageDigest: string;
}

export class RepoImage extends Resource {
  constructor(scope: Construct, name: string, public options: HTTPTaskOptions, config?: ResourceConfig) {
    super(scope, name, config);
  }

  readonly repo = new ecr.DataAwsEcrRepository(this, 'repo', {
    name: this.options.repoName,
  });

  readonly image = new ecr.DataAwsEcrImage(this, 'image', {
    repositoryName: this.repo.name,
    imageDigest: this.options.imageDigest,
  });

  readonly imageUri = `${this.options.sharedEnv.AWS_ACCOUNT_ID}.dkr.ecr.${z
    .string()
    .parse(this.options.aws.region)}.amazonaws.com/${this.image.repositoryName}@${z
    .string()
    .parse(this.image.imageDigest)}`;
}
