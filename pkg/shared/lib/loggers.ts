import stringify from 'safe-stable-stringify';
import type { Logger } from 'winston';
import * as winston from 'winston';

const replacer = (_key: string, value: unknown): unknown => {
  if (value instanceof Buffer) return value.toString('base64');
  if (value instanceof Set) return `Set(${[...value].join(', ')})`;
  if (typeof value === 'bigint') return value.toString();
  return value;
};

export const cloudwatchLogsFormat = winston.format.printf((info) => {
  return `${info.level}: ${info.message} ${stringify(info, replacer)}`;
});

export const createLambdaLogger = (service: string): Logger => {
  const logger = winston.createLogger({
    level: 'debug',
    format: winston.format.json(),
    defaultMeta: { service },
  });

  logger.add(
    new winston.transports.Console({
      level: 'debug',
      format: cloudwatchLogsFormat,
    }),
  );
  return logger;
};
