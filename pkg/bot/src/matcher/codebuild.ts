import { z } from 'zod';
import type { CallbackMatcher } from '../type/matcher';

const codeBuildMessageSchema = z.object({
  /** example: '111111111111' */
  account: z.string(),
  /** example:  'CodeBuild Build State Change' */
  detailType: z.string(),
  /** example:  'ap-northeast-1 Build State Change' */
  region: z.string(),
  /** example:  'aws.codebuild' */
  source: z.string(),
  /** example:  '2021-10-17T09:39:59Z' */
  time: z.string(),
  /** example:  'arn:aws:codestar-notifications:ap-northeast-1:111111111111:notificationrule/xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx' */
  notificationRuleArn: z.string(),
  detail: z.object({
    /** example:  'IN_PROGRESS' */
    'build-status': z.string(),
    /** example:  'arn:aws:codebuild:ap-northeast-1:111111111111:build/some-project:xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx' */
    'build-id': z.string(),
    /** example:  'some-project' */
    'project-name': z.string(),
    'additional-information': z.object({
      cache: z.unknown(),
      'timeout-in-minutes': z.number(),
      'build-complete': z.boolean(),
      initiator: z.string(),
      'build-start-time': z.string(),
      source: z.unknown(),
      'source-version': z.unknown(),
      artifact: z.unknown(),
      environment: z.unknown(),
      logs: z.object({
        /** example: 'https://console.aws.amazon.com/cloudwatch/home?region=ap-northeast-1#logEvent:group=null;stream=null' */
        'deep-link': z.string(),
      }),
      'queued-timeout-in-minutes': z.number(),
    }),
    /** example: 'SUBMITTED' */
    'current-phase': z.string(),
    /** example: '[]' */
    'current-phase-context': z.string(),
    /** example:  '1' */
    version: z.string(),
  }),
  /** example: ['arn:aws:codebuild:ap-northeast-1:111111111111:build/some-project:xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'] */
  resources: z.array(z.string()),
  /** example: {} */
  additionalAttributes: z.unknown(),
});

const handler: CallbackMatcher = {
  name: 'CodeBuild Status Change',
  async match(_ctx, message) {
    const codeBuildMessage = codeBuildMessageSchema.parse(message);
    return { messages: [], triggers: [codeBuildMessage.detail['build-id']] };
  },
};

export default handler;
