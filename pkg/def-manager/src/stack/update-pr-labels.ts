import type { s3 } from '@cdktf/provider-aws';
import { iam } from '@cdktf/provider-aws';
import type { ResourceConfig } from '@cdktf/provider-null';
import { Resource } from '@cdktf/provider-null';
import type { ManagerEnv, SharedEnv } from '@self/shared/lib/def/env-vars';
import type { Construct } from 'constructs';
import { z } from 'zod';
import type { Bot, BuildDictContext } from './bot';
import { RunScript } from './run-script';

export interface UpdatePRLabelsOptions {
  tagsAll: Record<string, string>;
  prefix: string;
  logsPrefix: string;
  sharedEnv: SharedEnv;
  managerEnv: ManagerEnv;
  infraSourceBucket: s3.S3Bucket;
  infraSourceZip: s3.S3BucketObject;
  bot: Bot;

  buildDictContext: BuildDictContext;
}

export class UpdatePRLabels extends Resource {
  constructor(scope: Construct, name: string, public options: UpdatePRLabelsOptions, config?: ResourceConfig) {
    super(scope, name, config);
  }

  readonly runScript = new RunScript(this, 'runScript', {
    name: 'UpLa',
    prefix: 'vio-d-upla',
    logsPrefix: `${this.options.logsPrefix}/dev-openv`,
    bot: this.options.bot,
    sharedEnv: this.options.sharedEnv,
    managerEnv: this.options.managerEnv,
    runScriptName: 'update-pr-labels.ts',
    infraSourceBucket: this.options.infraSourceBucket,
    infraSourceZip: this.options.infraSourceZip,

    buildDictContext: this.options.buildDictContext,

    tagsAll: {
      ...this.options.tagsAll,
    },
  });

  readonly rolePolicyDocument = new iam.DataAwsIamPolicyDocument(this, 'rolePolicyDocument', {
    version: '2012-10-17',
    statement: [
      {
        effect: 'Allow',
        actions: ['ssm:GetParameter', 'ssm:GetParameters'],
        resources: this.options.bot.parameters.map((p) => p.arn),
      },
    ],
  });

  readonly rolePolicy = new iam.IamRolePolicy(this, 'rolePolicy', {
    namePrefix: this.options.prefix,
    role: z.string().parse(this.runScript.buildStack.role.name),
    policy: this.rolePolicyDocument.json,
  });
}
