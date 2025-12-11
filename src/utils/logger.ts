import { consola, LogLevels } from 'consola';

export const logger = consola.create({
    defaults: {
        tag: 'astrical',
    },
    level: LogLevels.info, // Default to info
});

export function setDebugMode(enabled: boolean) {
    logger.level = enabled ? LogLevels.debug : LogLevels.info;
}
