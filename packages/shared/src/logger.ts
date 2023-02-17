import pino from 'pino';

export const logger = pino({
    level: process.env.LOG_LEVEL ?? 'info',
    messageKey: 'message',
    formatters: {
        level(label) {
            return { level: label };
        },
    },
});
