import type { CallbackHandler } from '../type/handler';
import { tryParseJSON } from '../util/try-parse-json';
import { queryOneOrNull } from './util/db';

/* eslint-disable @typescript-eslint/no-explicit-any */
const handler: CallbackHandler = {
  async handle(ctx, event: any, _context) {
    const messageRaw = event?.Records?.[0]?.Sns?.Message;
    if (typeof messageRaw !== 'string') return null;
    const messageUnknown: any = tryParseJSON(messageRaw);
    if (typeof messageUnknown !== 'object' || messageUnknown == null) return null;
    if (typeof messageUnknown.detail?.['build-status'] !== 'string') return null;
    if (typeof messageUnknown.detail?.['build-id'] !== 'string') return null;
    const message: CodeBuildMessage = messageUnknown as any;
    return queryOneOrNull(
      {
        TableName: ctx.env.TABLE_NAME,
        FilterExpression: 'buildArn = :arn',
        ExpressionAttributeValues: { ':arn': { S: message.detail['build-id'] } },
      },
      ctx.logger,
    );
  },
};
/* eslint-enable @typescript-eslint/no-explicit-any */

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
