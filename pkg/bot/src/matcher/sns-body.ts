import { z } from 'zod';
import type { CallbackMatcher } from '../type/matcher';

const snsBodySchema = z.object({
  Type: z.literal('Notification'),
  MessageId: z.string(),
  TopicArn: z.string(),
  Message: z.string(),
  Timestamp: z.string(),
  Signature: z.string(),
  SigningCertURL: z.string(),
  UnsubscribeURL: z.string(),
});

const matcher: CallbackMatcher = {
  name: 'SNS Body',
  async match(_ctx, message) {
    const snsBody = snsBodySchema.parse(message);
    const messages = [JSON.parse(snsBody.Message)];
    return { messages, triggers: [] };
  },
};

export default matcher;
