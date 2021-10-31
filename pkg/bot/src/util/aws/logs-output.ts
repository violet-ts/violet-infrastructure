/* eslint-disable no-await-in-loop */
import { CloudWatchLogs } from 'aws-sdk';

export const collectLogsOutput = async (
  logGroupName: string,
  logStreamNames: readonly string[],
): Promise<Record<string, string>> => {
  const pattern = /^!output=([^=]*)=(.*)$/;
  const logs = new CloudWatchLogs();
  let nextToken: string | undefined;
  const p: Record<string, string> = Object.create(null);
  do {
    const r = await logs
      .filterLogEvents({
        filterPattern: '"!output="',
        logGroupName,
        logStreamNames: [...logStreamNames],
        nextToken,
      })
      .promise();
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
/* eslint-enable no-await-in-loop */
