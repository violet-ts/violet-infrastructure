import type { Construct } from 'constructs';
import { TerraformStack } from 'cdktf';
import { AwsProvider, ResourcegroupsGroup, EcrRepository, S3Bucket } from '@cdktf/provider-aws';
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
  constructor(scope: Construct, name: string, options: VioletManagerOptions) {
    super(scope, name);

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
    const allResources = new ResourcegroupsGroup(this, 'resources-all', {
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
    const managerResources = new ResourcegroupsGroup(this, 'resources-manager', {
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
    const ecsRepoProdFrontend = new EcrRepository(this, 'prod-api', {
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
    const ecsRepoDevFrontend = new EcrRepository(this, 'dev-api', {
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
    // S3 Bucket - DB snapshot for production
    // TODO(scale): for release
    // -----------------------------------------------------------------
    const dbSnapshotsProd = new S3Bucket(this, 'db-snapshots-prod', {
      // TODO(service): for prod: protection for deletion, versioning
      // TODO(security): for prod: encryption
      // TODO(logging): for prod
      // TODO(cost): for prod: lifecycle
      bucket: `violet-db-snapshots-prod`,
      forceDestroy: true,
      tags: genTags(null, 'production'),
    });
    void dbSnapshotsProd;

    // -----------------------------------------------------------------
    // S3 Bucket - DB snapshot for development
    // TODO(scale): for release
    // -----------------------------------------------------------------
    const dbSnapshotsDev = new S3Bucket(this, 'db-snapshots-dev', {
      // TODO(service): for prod: protection for deletion, versioning
      // TODO(security): for prod: encryption
      // TODO(logging): for prod
      // TODO(cost): for prod: lifecycle
      bucket: `violet-db-snapshots-dev`,
      forceDestroy: true,
      tags: genTags(null, 'development'),
    });
    void dbSnapshotsDev;
  }
}
