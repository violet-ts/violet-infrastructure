import type { Construct } from 'constructs';
import { TerraformStack } from 'cdktf';
import {
  AwsProvider,
  ResourcegroupsGroup,
  EcrRepository,
  S3Bucket,
  IamRole,
  IamRolePolicy,
  Apigatewayv2Api,
  CodebuildProject,
} from '@cdktf/provider-aws';
import { String as RandomString } from '@cdktf/provider-random';
import { PROJECT_NAME } from '../const';

/**
 * - production
 * - development
 *   +- staging
 *   +- preview
 */
export type Section = 'development' | 'preview' | 'staging' | 'production';

export interface VioletManagerOptions {
  region: string;
}

const genTags = (name: string | null, section?: Section | null): Record<string, string> => {
  const tags: Record<string, string> = {
    Project: PROJECT_NAME,
    /** マネージャ層であることを示すフラグ */
    Manager: 'true',
    /** IaC で管理している、というフラグ */
    Managed: 'true',
  };
  if (name != null) tags.Name = name;
  if (section != null) tags.Section = section;
  return tags;
};

export class VioletManagerStack extends TerraformStack {
  get uniqueName(): string {
    return `manager-${this.options.region}`;
  }

  constructor(scope: Construct, name: string, private options: VioletManagerOptions) {
    super(scope, name);

    // =================================================================
    // Random Suffix
    // https://registry.terraform.io/providers/hashicorp/random/latest/docs/resources/string
    // =================================================================
    const suffix = new RandomString(this, 'suffix', {
      length: 6,
    });
    void suffix;

    // =================================================================
    // AWS Provider
    // =================================================================
    const awsProvider = new AwsProvider(this, 'aws', {
      region: options.region,
      profile: process.env.AWS_PROFILE,
      accessKey: process.env.AWS_ACCESS_KEY,
      secretKey: process.env.AWS_SECRET_KEY,
    });
    void awsProvider;

    // =================================================================
    // Resource Groups
    // -----------------------------------------------------------------
    // Violet プロジェクトすべてのリソース
    // =================================================================
    const allResources = new ResourcegroupsGroup(this, 'allResources', {
      name: `violet-all`,
      resourceQuery: [
        {
          query: JSON.stringify({
            ResourceTypeFilters: ['AWS::AllSupported'],
            TagFilters: [
              {
                Key: 'Project',
                Values: [PROJECT_NAME],
              },
            ],
          }),
        },
      ],
      tags: genTags('Project Violet All Resources'),
    });
    void allResources;

    // =================================================================
    // Resource Groups
    // -----------------------------------------------------------------
    // Violet Manager のリソース
    // =================================================================
    const managerResources = new ResourcegroupsGroup(this, 'managerResources', {
      name: `violet-manager`,
      resourceQuery: [
        {
          query: JSON.stringify({
            ResourceTypeFilters: ['AWS::AllSupported'],
            TagFilters: [
              {
                Key: 'Project',
                Values: [PROJECT_NAME],
              },
              {
                Key: 'Manager',
                Values: ['true'],
              },
            ],
          }),
        },
      ],
      tags: genTags('Project Violet Manager Resources'),
    });
    void managerResources;

    // =================================================================
    // ECS Repositories
    // https://docs.aws.amazon.com/AmazonECR/latest/APIReference/API_Repository.html
    // -----------------------------------------------------------------
    // 管理方針
    // Production と Staging + Preview で無効化方針が変わるため分ける
    // TODO: Public Repository のほうがよいかもしれない
    // =================================================================

    // -----------------------------------------------------------------
    // ECS Repository - Production API
    // -----------------------------------------------------------------
    const ecsRepoProdFrontend = new EcrRepository(this, 'ecsRepoProdFrontend', {
      name: `violet-prod-api`,
      imageTagMutability: 'IMMUTABLE',
      // TODO(security): for production
      // imageScanningConfiguration,
      tags: genTags(null),
    });
    void ecsRepoProdFrontend;

    // -----------------------------------------------------------------
    // ECS Repository - Development API
    // -----------------------------------------------------------------
    const ecsRepoDevFrontend = new EcrRepository(this, 'ecsRepoDevFrontend', {
      name: `violet-dev-api`,
      imageTagMutability: 'MUTABLE',
      // TODO(security): for production
      // imageScanningConfiguration,
      tags: genTags(null, 'development'),
    });
    void ecsRepoDevFrontend;

    // =================================================================
    // S3 Buckets
    // https://docs.aws.amazon.com/AmazonS3/latest/API/API_Types.html
    // =================================================================

    // -----------------------------------------------------------------
    // API Gateway
    // -----------------------------------------------------------------
    // new Apigatewayv2Api(this, '', {
    //   tags:
    // });
  }
}
