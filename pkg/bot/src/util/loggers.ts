import * as winston from 'winston';
import type { Logger } from 'winston';

export const createLambdaLogger = (): Logger => {
  const logger = winston.createLogger({
    level: process.env.LOG_LEVEL ?? 'info',
    format: winston.format.json(),
    defaultMeta: { service: 'github-bot' },
  });

  logger.add(
    new winston.transports.Console({
      format: winston.format.prettyPrint(),
    }),
  );
  return logger;
};
