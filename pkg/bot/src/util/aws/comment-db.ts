import { DynamoDB } from '@aws-sdk/client-dynamodb';
import type { Credentials, Provider } from '@aws-sdk/types';
import { unmarshall } from '@aws-sdk/util-dynamodb';
import type { FullEntryForTypeCheck } from '@self/bot/src/type/cmd';
import { parseFullEntryForTypeCheck } from '@self/bot/src/util/parse-entry';
import type { AccumuratedBotEnv } from '@self/shared/lib/bot/env';
import type { Logger } from 'winston';

interface GetEntryByUUIDParmas {
  env: AccumuratedBotEnv;
  credentials: Credentials | Provider<Credentials>;
  logger: Logger;
  uuid: string;
}
export const getEntryByUUID = async ({
  env,
  uuid,
  logger,
  credentials,
}: GetEntryByUUIDParmas): Promise<FullEntryForTypeCheck> => {
  const db = new DynamoDB({ logger, credentials });
  const item = (
    await db.getItem({
      TableName: env.BOT_TABLE_NAME,
      Key: { uuid: { S: uuid } },
    })
  ).Item;
  if (item == null) throw new Error(`item not found for uuid "${uuid}"`);
  const fullEntry: FullEntryForTypeCheck = parseFullEntryForTypeCheck(unmarshall(item));
  return fullEntry;
};
