import * as winston from 'winston';
import type { Logger } from 'winston';

export const cloudwatchLogsFormat = winston.format.printf(({ message, level, meta }) => {
  return `${level}: ${message} ${JSON.stringify(meta)}`;
});

export const createLambdaLogger = (service: string): Logger => {
  const logger = winston.createLogger({
    level: 'debug',
    format: winston.format.json(),
    defaultMeta: { service },
  });

  logger.add(
    new winston.transports.Console({
      format: cloudwatchLogsFormat,
    }),
  );
  return logger;
};
