import type { s3 } from '@cdktf/provider-aws';
import { iam } from '@cdktf/provider-aws';
import type { ResourceConfig } from '@cdktf/provider-null/lib/resource';
import { Resource } from '@cdktf/provider-null/lib/resource';
import { StringResource as RandomString } from '@cdktf/provider-random';
import type { ManagerEnv, SharedEnv } from '@self/shared/lib/def/env-vars';
import { ensurePath } from '@self/shared/lib/def/util/ensure-path';
import type { ComputedRunScriptEnv } from '@self/shared/lib/run-script/env';
import { computedRunScriptCodeBuildEnv } from '@self/shared/lib/run-script/env';
import type { CodeBuildEnv } from '@self/shared/lib/util/aws-cdk';
import type { Construct } from 'constructs';
import path from 'path';
import { z } from 'zod';
import type { Bot, BuildDictContext } from './bot';
import { CodeBuildStack } from './codebuild-stack';
import { sharedScriptsDir } from './values';

export interface RunScriptOptions {
  tagsAll: Record<string, string>;
  name: string;
  sharedEnv: SharedEnv;
  managerEnv: ManagerEnv;
  infraSourceBucket: s3.S3Bucket;
  infraSourceZip: s3.S3BucketObject;
  prefix: string;
  logsPrefix: string;
  runScriptName: string;
  bot: Bot;
  environmentVariable?: CodeBuildEnv | undefined;

  buildDictContext: BuildDictContext;
}

export class RunScript extends Resource {
  constructor(scope: Construct, name: string, public options: RunScriptOptions, config?: ResourceConfig) {
    super(scope, name, config);
  }

  readonly scriptPath = ensurePath(path.resolve(sharedScriptsDir, this.options.runScriptName));

  private readonly suffix = new RandomString(this, 'suffix', {
    length: 6,
    lower: true,
    upper: false,
    special: false,
  });

  readonly computedRunScriptEnv: ComputedRunScriptEnv = {
    RUN_SCRIPT_NAME: this.options.runScriptName,
  };

  readonly buildStack = this.options.buildDictContext.add(
    this.options.name,
    new CodeBuildStack(this, 'buildStack', {
      sharedEnv: this.options.sharedEnv,
      managerEnv: this.options.managerEnv,
      buildSpecName: 'run-script.yml',
      prefix: `${this.options.prefix}-bs`,
      logsPrefix: this.options.logsPrefix,
      bot: this.options.bot,
      environmentVariable: [
        ...computedRunScriptCodeBuildEnv(this.computedRunScriptEnv),
        ...(this.options.environmentVariable ?? []),
      ],

      tagsAll: {
        ...this.options.tagsAll,
      },
    }),
  );

  readonly rolePolicyDocument = new iam.DataAwsIamPolicyDocument(this, 'rolePolicyDocument', {
    version: '2012-10-17',
    statement: [
      {
        effect: 'Allow',
        actions: [
          'dynamodb:PutItem',
          'dynamodb:BatchPutItem',
          'dynamodb:GetItem',
          'dynamodb:BatchWriteItem',
          'dynamodb:UpdateItem',
          'dynamodb:DeleteItem',
          'dynamodb:Query',
          'dynamodb:Scan',
        ],
        resources: [this.options.bot.table.arn, this.options.bot.issueMap.arn],
      },
      {
        effect: 'Allow',
        actions: ['s3:GetObject'],
        resources: [`${this.options.infraSourceBucket.arn}/${this.options.infraSourceZip.key}`],
      },
    ],
  });

  readonly rolePolicy = new iam.IamRolePolicy(this, 'rolePolicy', {
    name: `${this.options.prefix}-${this.suffix.result}`,
    role: z.string().parse(this.buildStack.role.name),
    policy: this.rolePolicyDocument.json,
  });
}
