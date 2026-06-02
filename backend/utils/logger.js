import { createLogger, format, transports } from 'winston';
import { mkdirSync } from 'fs';

mkdirSync('logs', { recursive: true });

const logger = createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  transports: [
    new transports.Console({
      format: format.combine(
        format.timestamp(),
        format.colorize(),
        format.simple()
      ),
    }),
    new transports.File({
      filename: 'logs/error.log',
      level: 'error',
    }),
  ],
});

export default logger;
