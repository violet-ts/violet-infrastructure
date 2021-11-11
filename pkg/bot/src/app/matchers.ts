import codebuild from '@self/bot/src/matcher/codebuild';
import eventRecords from '@self/bot/src/matcher/event-records';
import snsEventRecord from '@self/bot/src/matcher/sns-event-record';
import snsBody from '@self/bot/src/matcher/sns-body';
import sqsBody from '@self/bot/src/matcher/sqs-body';
import type { CallbackMatcher } from '@self/bot/src/type/matcher';

export const matchers: CallbackMatcher[] = [codebuild, eventRecords, snsEventRecord, snsBody, sqsBody];
