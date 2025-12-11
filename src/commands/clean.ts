
import { BaseCommand } from '../core/BaseCommand';
import fs from 'fs-extra';
import path from 'path';

export default class CleanCommand extends BaseCommand {
    static paths = [['clean']];
    static usage = 'clean';

    async run() {
        // Core cleaning logic
        const targets = [
            '_site',
            'dist',
            path.join('node_modules', '.vite')
        ];

        for (const target of targets) {
            const targetPath = path.resolve(process.cwd(), target);
            if (await fs.pathExists(targetPath)) {
                await fs.remove(targetPath);
                // BaseCommand doesn't expose logger property, use helpers or import
                this.info(`Removed: ${target}`);
            }
        }

        this.success('Project environment cleaned.');
    }
}
