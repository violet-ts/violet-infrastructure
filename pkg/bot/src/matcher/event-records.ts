import { z } from 'zod';
import type { CallbackMatcher } from '../type/matcher';

const lambdaEventSchema = z.object({
  Records: z.array(z.unknown()),
});

const matcher: CallbackMatcher = {
  name: 'Event Records',
  async match(_ctx, message) {
    const lambdaEvent = lambdaEventSchema.parse(message);
    const messages = lambdaEvent.Records;
    return { messages, triggers: [] };
  },
};

export default matcher;
