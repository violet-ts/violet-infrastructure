import type { Update } from '@aws-sdk/client-dynamodb';
import { DynamoDB } from '@aws-sdk/client-dynamodb';
import type { Credentials, Provider } from '@aws-sdk/types';
import { marshall } from '@self/shared/lib/util/aws/dynamodb';
import type { Logger } from 'winston';

export const updateTableRootKeys = async (
  updateObj: Record<string, unknown>,
  tableName: string,
  Key: Update['Key'],
  credentials: Credentials | Provider<Credentials>,
  _logger: Logger,
): Promise<void> => {
  const entries = Object.entries(updateObj);
  const setExpr = entries.map((_entry, i) => `#key${i} = :value${i}`).join(', ');
  const keys = Object.fromEntries(entries.map(([key], i) => [`#key${i}`, key]));
  const values = marshall(Object.fromEntries(entries.map(([_key, value], i) => [`:value${i}`, value])));
  const db = new DynamoDB({ credentials });
  // https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Expressions.UpdateExpressions.html

  await db.updateItem({
    TableName: tableName,
    Key,
    UpdateExpression: `SET ${setExpr}`,
    ExpressionAttributeNames: keys,
    ExpressionAttributeValues: values,
  });
};
