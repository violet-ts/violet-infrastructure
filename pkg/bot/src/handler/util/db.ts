import { DynamoDB } from 'aws-sdk';
import { unmarshall } from '@aws-sdk/util-dynamodb';
import type { Logger } from 'winston';
import type { GeneralEntry } from '../../type/cmd';

export const queryOneOrNull = async (scan: DynamoDB.ScanInput, logger: Logger): Promise<null | GeneralEntry> => {
  const db = new DynamoDB();
  const items = await db.scan(scan).promise();
  if (items.Count !== 1) {
    if ((items.Count ?? 0) >= 2) {
      logger.warn(`More than 2 items found: ${items.Count} items found`);
    }
    return null;
  }
  const item = items.Items?.[0];
  if (item == null) {
    logger.error(`Unreachable: item is not found.`);
    return null;
  }
  logger.debug('item', item);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any,@typescript-eslint/no-unsafe-return
  return unmarshall(item as any) as any;
};
