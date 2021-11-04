import type { ScanInput } from '@aws-sdk/client-dynamodb';
import { DynamoDB } from '@aws-sdk/client-dynamodb';
import { unmarshall } from '@aws-sdk/util-dynamodb';
import type { Credentials, Provider } from '@aws-sdk/types';
import type { Logger } from 'winston';

// https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_Scan.html
export const scanOne = async (
  scan: ScanInput,
  credentials: Credentials | Provider<Credentials>,
  logger: Logger,
): Promise<unknown> => {
  const db = new DynamoDB({ credentials, logger });
  const items = await db.scan(scan);
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

  const unmarshalled: unknown = unmarshall(item);
  return unmarshalled;
};
