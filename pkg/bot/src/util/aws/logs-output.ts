import { CloudWatchLogs } from '@aws-sdk/client-cloudwatch-logs';
import type { Credentials, Provider } from '@aws-sdk/types';
import type { Logger } from 'winston';

export const collectLogsOutput = async (
  logGroupName: string,
  logStreamNames: readonly string[],
  credentials: Credentials | Provider<Credentials>,
  logger: Logger,
): Promise<Record<string, string>> => {
  const pattern = /^!output=([^=]*)=(.*)$/;
  const logs = new CloudWatchLogs({ credentials, logger });
  let nextToken: string | undefined;
  const p: Record<string, string> = Object.create(null);
  do {
    const r = await logs.filterLogEvents({
      filterPattern: '"!output="',
      logGroupName,
      logStreamNames: [...logStreamNames],
      nextToken,
    });
    nextToken = r.nextToken;
    r.events?.forEach((event) => {
      const groups = event.message?.trim().match(pattern);
      if (groups != null) {
        const [, key, value] = groups;
        p[key] = value;
      }
    });
  } while (typeof nextToken === 'string');
  return p;
};
