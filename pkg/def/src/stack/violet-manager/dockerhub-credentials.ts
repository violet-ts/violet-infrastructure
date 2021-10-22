import { SecretsmanagerSecret, SecretsmanagerSecretVersion } from '@cdktf/provider-aws';
import type { ResourceConfig } from '@cdktf/provider-null';
import { Resource } from '@cdktf/provider-null';
import type { VioletManagerStack } from '.';
import type { SharedEnv } from '../../app/env-vars';
import { genTags } from './values';

export interface DockerHubCredentialsOptions {
  DOCKERHUB: Required<SharedEnv>['DOCKERHUB'];
}

export class DockerHubCredentials extends Resource {
  constructor(
    private parent: VioletManagerStack,
    name: string,
    public options: DockerHubCredentialsOptions,
    config?: ResourceConfig,
  ) {
    super(parent, name, config);
  }

  readonly USER_KEY = 'user';

  readonly PASS_KEY = 'pass';

  readonly credentials = new SecretsmanagerSecret(this, 'credentials', {
    namePrefix: `violet-${this.parent.suffix.result}-dockerhub-credentials`,
    tags: genTags(null),
  });

  readonly credentialsUserArn = `${this.credentials.arn}:${this.USER_KEY}`;

  readonly credentialsPassArn = `${this.credentials.arn}:${this.PASS_KEY}`;

  readonly credentialsValue = new SecretsmanagerSecretVersion(this, 'usernameValue', {
    secretId: this.credentials.id,
    secretString: JSON.stringify({
      [this.USER_KEY]: this.options.DOCKERHUB.USER,
      [this.PASS_KEY]: this.options.DOCKERHUB.PASS,
    }),
  });
}
