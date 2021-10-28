import { DynamoDB } from 'aws-sdk';
import { unmarshall } from '@aws-sdk/util-dynamodb';
import type { Logger } from 'winston';

// https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_Scan.html
export const scanOne = async (scan: DynamoDB.ScanInput, logger: Logger): Promise<unknown> => {
  const db = new DynamoDB();
  const items = await db.scan(scan).promise();
  if (items.Count !== 1) {
    if ((items.Count ?? 0) >= 2) {
      logger.warn(`Inconsistency: More than 2 items found: ${items.Count} items found`);
    }
    throw new Error('not found single item');
  }
  const item = items.Items?.[0];
  if (item == null) {
    logger.error(`Unreachable: item is not found.`);
    throw new Error('item is counted but not found');
  }
  logger.debug('item', item);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const unmarshalled: unknown = unmarshall(item as any);
  return unmarshalled;
};
