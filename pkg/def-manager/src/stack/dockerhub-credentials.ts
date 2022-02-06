import type { codebuild } from '@cdktf/provider-aws';
import { iam, secretsmanager } from '@cdktf/provider-aws';
import type { ResourceConfig } from '@cdktf/provider-null';
import { Resource } from '@cdktf/provider-null';
import type { DockerHubCred } from '@self/shared/lib/def/env-vars';
import type { VioletManagerStack } from '.';

export interface DockerHubCredentialsOptions {
  dockerHubCred: DockerHubCred;
  prefix: string;
  tagsAll: Record<string, string>;
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

  readonly credentials = new secretsmanager.SecretsmanagerSecret(this, 'credentials', {
    namePrefix: `${this.options.prefix}-dockerhub-credentials-`,

    tagsAll: {
      ...this.options.tagsAll,
    },
  });

  readonly credentialsUserArn = `${this.credentials.arn}:${this.USER_KEY}`;

  readonly credentialsPassArn = `${this.credentials.arn}:${this.PASS_KEY}`;

  readonly credentialsValue = new secretsmanager.SecretsmanagerSecretVersion(this, 'usernameValue', {
    secretId: this.credentials.id,
    secretString: JSON.stringify({
      [this.USER_KEY]: this.options.dockerHubCred.USER,
      [this.PASS_KEY]: this.options.dockerHubCred.PASS,
    }),
  });

  get codeBuildEnvironmentVariables(): codebuild.CodebuildProjectEnvironmentEnvironmentVariable[] {
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

  readonly policyDocument = new iam.DataAwsIamPolicyDocument(this, 'policyDocument', {
    version: '2012-10-17',
    statement: [
      {
        effect: 'Allow',
        resources: [this.credentials.arn],
        actions: ['secretsmanager:GetSecretValue'],
      },
    ],
  });
}
