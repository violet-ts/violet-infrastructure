import { ecr } from '@cdktf/provider-aws';
import type { ResourceConfig } from '@cdktf/provider-null';
import { Resource } from '@cdktf/provider-null';
import { StringResource as RandomString } from '@cdktf/provider-random';
import { RESOURCE_DEV_PREFIX, RESOURCE_PROD_PREFIX } from '@self/shared/lib/const';
import type { Construct } from 'constructs';
import type { RepoDictContext } from './bot';

export interface RepoStackOptions {
  prefix: string;
  name: string;
  tagsAll: Record<string, string>;
  devRepoDictContext: RepoDictContext;
}

export class RepoStack extends Resource {
  constructor(scope: Construct, name: string, public options: RepoStackOptions, config?: ResourceConfig) {
    super(scope, name, config);
  }

  private readonly suffix = new RandomString(this, 'suffix', {
    length: 6,
    lower: true,
    upper: false,
    special: false,
  });

  readonly prodRepo = new ecr.EcrRepository(this, 'prodRepo', {
    name: `${RESOURCE_PROD_PREFIX}${this.options.name.toLowerCase()}-${this.suffix.result}`,
    imageTagMutability: 'IMMUTABLE',
    imageScanningConfiguration: {
      scanOnPush: true,
    },
    tagsAll: {
      Section: 'production',
      ...this.options.tagsAll,
    },
  });

  readonly devRepo = this.options.devRepoDictContext.add(
    this.options.name,
    new ecr.EcrRepository(this, 'devRepo', {
      name: `${RESOURCE_DEV_PREFIX}${this.options.name.toLowerCase()}-${this.suffix.result}`,
      imageTagMutability: 'MUTABLE',
      tagsAll: {
        Section: 'development',
        ...this.options.tagsAll,
      },
    }),
  );
}
