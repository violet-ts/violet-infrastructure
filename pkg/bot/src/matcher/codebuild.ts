import { z } from 'zod';
import type { CallbackMatcher } from '../type/matcher';
import { tryParseJSON } from '../util/try-parse-json';
import { scanOne } from './util/db';

const snsEventSchema = z.object({
  Records: z.tuple([
    z.object({
      Sns: z.object({
        Message: z.string(),
      }),
    }),
  ]),
});

const codeBuildMessageSchema = z.object({
  detail: z.object({
    'build-status': z.string(),
    'build-id': z.string(),
    'project-name': z.string(),
  }),
});

// eslint-disable-next-line no-unused-expressions -- assert
(v: CodeBuildMessage) => {
  ((_: z.infer<typeof codeBuildMessageSchema>) => 0)(v);
};

const handler: CallbackMatcher = {
  name: 'CodeBuild Status Change',
  async handle(ctx, event, _context) {
    const snsEvent = snsEventSchema.parse(event);
    const messageRaw = snsEvent.Records[0].Sns.Message;
    const messageUnknown = tryParseJSON(messageRaw);
    const message = codeBuildMessageSchema.parse(messageUnknown);
    return scanOne(
      {
        TableName: ctx.env.BOT_TABLE_NAME,
        FilterExpression: 'contains(watchArns, :arn)',
        ExpressionAttributeValues: { ':arn': { S: message.detail['build-id'] } },
      },
      ctx.credentials,
      ctx.logger,
    );
  },
};

export type CodeBuildMessage = {
  /** example: '111111111111' */
  account: string;
  /** example:  'CodeBuild Build State Change' */
  detailType: string;
  /** example:  'ap-northeast-1 Build State Change' */
  region: string;
  /** example:  'aws.codebuild' */
  source: string;
  /** example:  '2021-10-17T09:39:59Z' */
  time: string;
  /** example:  'arn:aws:codestar-notifications:ap-northeast-1:111111111111:notificationrule/xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx' */
  notificationRuleArn: string;
  detail: {
    /** example:  'IN_PROGRESS' */
    'build-status': string;
    /** example:  'some-project' */
    'project-name': string;
    /** example:  'arn:aws:codebuild:ap-northeast-1:111111111111:build/some-project:xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx' */
    'build-id': string;
    'additional-information': {
      cache: unknown;
      'timeout-in-minutes': number;
      'build-complete': boolean;
      initiator: string;
      'build-start-time': string;
      source: unknown;
      'source-version': unknown;
      artifact: unknown;
      environment: unknown;
      logs: {
        /** example: 'https://console.aws.amazon.com/cloudwatch/home?region=ap-northeast-1#logEvent:group=null;stream=null' */
        'deep-link': string;
      };
      'queued-timeout-in-minutes': number;
    };
    /** example: 'SUBMITTED' */
    'current-phase': string;
    /** example: '[]' */
    'current-phase-context': string;
    /** example:  '1' */
    version: string;
  };
  /** example: ['arn:aws:codebuild:ap-northeast-1:111111111111:build/some-project:xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'] */
  resources: string[];
  /** example: {} */
  additionalAttributes: unknown;
};

export default handler;
