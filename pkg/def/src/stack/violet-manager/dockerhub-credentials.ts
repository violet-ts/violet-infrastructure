import type { CodeBuild } from '@cdktf/provider-aws';
import { SecretsManager } from '@cdktf/provider-aws';
import type { ResourceConfig } from '@cdktf/provider-null';
import { Resource } from '@cdktf/provider-null';
import type { VioletManagerStack } from '.';
import type { SharedEnv } from '../../app/env-vars';

export interface DockerHubCredentialsOptions {
  DOCKERHUB: Required<SharedEnv>['DOCKERHUB'];
  tags: Record<string, string>;
  prefix: string;
}

export class DockerHubCredentials extends Resource {
  constructor(
    parent: VioletManagerStack,
    name: string,
    public options: DockerHubCredentialsOptions,
    config?: ResourceConfig,
  ) {
    super(parent, name, config);
  }

  readonly USER_KEY = 'user';

  readonly PASS_KEY = 'pass';

  readonly credentials = new SecretsManager.SecretsmanagerSecret(this, 'credentials', {
    namePrefix: `${this.options.prefix}-dockerhub-credentials-`,
    tags: {
      ...this.options.tags,
    },
  });

  readonly credentialsUserArn = `${this.credentials.arn}:${this.USER_KEY}`;

  readonly credentialsPassArn = `${this.credentials.arn}:${this.PASS_KEY}`;

  readonly credentialsValue = new SecretsManager.SecretsmanagerSecretVersion(this, 'usernameValue', {
    secretId: this.credentials.id,
    secretString: JSON.stringify({
      [this.USER_KEY]: this.options.DOCKERHUB.USER,
      [this.PASS_KEY]: this.options.DOCKERHUB.PASS,
    }),
  });

  get codeBuildEnvironmentVariables(): CodeBuild.CodebuildProjectEnvironmentEnvironmentVariable[] {
    return [
      {
        name: 'DOCKERHUB_USER',
        value: this.credentialsUserArn,
        type: 'SECRETS_MANAGER',
      },
      {
        name: 'DOCKERHUB_PASS',
        value: this.credentialsPassArn,
        type: 'SECRETS_MANAGER',
      },
    ];
  }
}
