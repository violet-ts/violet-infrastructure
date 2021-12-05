import { DynamoDB } from '@aws-sdk/client-dynamodb';
import type { Credentials, Provider } from '@aws-sdk/types';
import { unmarshall } from '@aws-sdk/util-dynamodb';
import type { IssueMapEntry } from '@self/bot/src/type/issue-map';
import { issueMapEntrySchema } from '@self/bot/src/type/issue-map';
import type { AccumuratedBotEnv } from '@self/shared/lib/bot/env';
import { marshall } from '@self/shared/lib/util/aws/dynamodb';
import type { Logger } from 'winston';

export interface EnsureIssueMapParams {
  env: Pick<AccumuratedBotEnv, 'BOT_ISSUE_MAP_TABLE_NAME'>;
  credentials: Credentials | Provider<Credentials>;
  logger: Logger;
  prNumber: number;
}
export const ensureIssueMap = async ({
  env,
  credentials,
  logger,
  prNumber,
}: EnsureIssueMapParams): Promise<IssueMapEntry> => {
  const db = new DynamoDB({ credentials, logger });
  const item = (
    await db.getItem({
      TableName: env.BOT_ISSUE_MAP_TABLE_NAME,
      Key: {
        number: {
          N: prNumber.toString(),
        },
      },
    })
  ).Item;
  const issueMap = item && issueMapEntrySchema.parse(unmarshall(item));
  if (issueMap != null) return issueMap;
  const newIssueMap: IssueMapEntry = {
    number: prNumber,
  };
  await db.putItem({
    TableName: env.BOT_ISSUE_MAP_TABLE_NAME,
    Item: marshall(newIssueMap),
  });
  return newIssueMap;
};
