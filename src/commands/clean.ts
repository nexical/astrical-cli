
import { BaseCommand } from '../core/src/BaseCommand.js';
import fs from 'fs-extra';
import path from 'path';
import { logger } from '../core/src/utils/logger.js';

export default class CleanCommand extends BaseCommand {
    static paths = [['clean']];
    static usage = 'clean';
    static description = 'Clean project artifacts and caches.';

    async run() {
        // Core cleaning logic
        const targets = [
            '_site',
            'dist',
            path.join('node_modules', '.vite')
        ];

        for (const target of targets) {
            const targetPath = path.resolve(process.cwd(), target);
            logger.debug(`Checking clean target: ${targetPath}`);
            if (await fs.pathExists(targetPath)) {
                await fs.remove(targetPath);
                // BaseCommand doesn't expose logger property, use helpers or import
                this.info(`Removed: ${target}`);
            }
        }

        this.success('Project environment cleaned.');
    }
}
