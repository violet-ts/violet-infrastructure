import { z } from 'zod';
import type { CallbackMatcher } from '../type/matcher';

const sqsBodySchema = z.object({
  attributes: z
    .object({
      /** example:  "1636543031960" */
      ApproximateFirstReceiveTimestamp: z.string().optional(),
      /** example: "1" */
      ApproximateReceiveCount: z.string().optional(),
      /** example: "AIDAIERWYNSNBY7YRB6SY" */
      SenderId: z.string().optional(),
      /** example:  "1636543031946" */
      SentTimestamp: z.string().optional(),
    })
    .optional(),
  /** example: "ap-northeast-1" */
  awsRegion: z.string(),
  /** example: "{...}" */
  body: z.string(),
  eventSource: z.literal('aws:sqs'),
  /** example:  "arn:aws:sqs:ap-northeast-1:111111111111:aaaaaaaaaaaaaaaaa" */
  eventSourceARN: z.string(),
  /** example:  "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" */
  md5OfBody: z.string().optional(),
  /** exapmle: {} */
  messageAttributes: z.record(z.unknown()),
  /** example:  "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa" */
  messageId: z.string().optional(),
  /** example:  "AQ...Yiw==" */
  receiptHandle: z.string().optional(),
});

const matcher: CallbackMatcher = {
  name: 'SQS Body',
  async match(_ctx, message) {
    const sqsBody = sqsBodySchema.parse(message);
    const messages = [JSON.parse(sqsBody.body)];
    return { messages, triggers: [] };
  },
};

export default matcher;
