import type { CodeBuild } from '@cdktf/provider-aws';
import { SecretsManager, IAM } from '@cdktf/provider-aws';
import type { ResourceConfig } from '@cdktf/provider-null';
import { Resource } from '@cdktf/provider-null';
import type { SharedEnv } from '@self/shared/lib/def/env-vars';
import type { VioletManagerStack } from '.';

export interface DockerHubCredentialsOptions {
  DOCKERHUB: Required<SharedEnv>['DOCKERHUB'];
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

  readonly credentials = new SecretsManager.SecretsmanagerSecret(this, 'credentials', {
    namePrefix: `${this.options.prefix}-dockerhub-credentials-`,

    tagsAll: {
      ...this.options.tagsAll,
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

  readonly policyDocument = new IAM.DataAwsIamPolicyDocument(this, 'policyDocument', {
    version: '2012-10-17',
    statement: [
      {
        effect: 'Allow',
        resources: [this.credentials.arn],
        actions: ['secretsmanager:GetSecretValue'],
      },
    ],
  });

  readonly policy = new IAM.IamPolicy(this, 'policy', {
    namePrefix: this.options.prefix,
    policy: this.policyDocument.json,
  });
}
