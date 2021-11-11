import { z } from 'zod';
import type { CallbackMatcher } from '../type/matcher';

const snsEventRecordSchema = z.object({
  Sns: z.record(z.unknown()),
});

const matcher: CallbackMatcher = {
  name: 'SNS Event Record',
  async match(_ctx, message) {
    const snsEventRecord = snsEventRecordSchema.parse(message);
    const messages = [snsEventRecord.Sns];
    return { messages, triggers: [] };
  },
};

export default matcher;
