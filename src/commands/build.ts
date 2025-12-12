
import { BaseCommand } from '../core/src/BaseCommand.js';
import fs from 'fs-extra';
import path from 'path';
import { runCommand } from '../core/src/utils/shell.js';
import { logger } from '../core/src/utils/logger.js';

export default class BuildCommand extends BaseCommand {
    static paths = [['build']];
    static usage = 'build';
    static description = 'Builds the production site.';
    static requiresProject = true;

    async run(options: any) {
        if (!this.projectRoot) {
            this.error('Project root not found.');
            return;
        }

        const siteDir = path.resolve(this.projectRoot, '_site');
        const srcDir = path.resolve(this.projectRoot, 'src');
        const coreDir = path.resolve(srcDir, 'core');
        const modulesDir = path.resolve(srcDir, 'modules');
        const contentDir = path.resolve(srcDir, 'content');
        const publicDir = path.resolve(this.projectRoot, 'public');

        logger.debug('Build paths resolved:', { siteDir, srcDir, coreDir, modulesDir, contentDir, publicDir });

        this.info('Building for production...');

        // 1. Clean _site
        logger.debug(`Cleaning site directory: ${siteDir}`);
        await fs.remove(siteDir);
        await fs.ensureDir(siteDir);

        // 2. Copy Core contents
        if (await fs.pathExists(coreDir)) {
            await fs.copy(coreDir, siteDir, {
                overwrite: true,
                filter: (src) => !src.includes('node_modules')
            });
        } else {
            this.error(`Core directory not found at ${coreDir}`);
            return;
        }

        // 3. Copy Modules
        const siteModulesDir = path.join(siteDir, 'src/modules');
        if (await fs.pathExists(modulesDir)) {
            await fs.copy(modulesDir, siteModulesDir);
        }

        // 4. Copy Content
        const siteContentDir = path.join(siteDir, 'content');
        if (await fs.pathExists(contentDir)) {
            await fs.copy(contentDir, siteContentDir);
        }

        // 5. Copy Public
        const sitePublicDir = path.join(siteDir, 'public');
        if (await fs.pathExists(publicDir)) {
            await fs.copy(publicDir, sitePublicDir);
        }

        this.info('Environment assembled. Running Astro build...');

        // 6. Run Astro using local binary from project root
        // This avoids relying on global npx or PATH issues in tests
        const astroBin = path.join(this.projectRoot, 'node_modules', '.bin', 'astro');
        logger.debug(`Using astro binary at: ${astroBin}`);

        try {
            await runCommand(`${astroBin} build`, siteDir);

            this.success('Build completed successfully.');
            this.success(`Output generated at ${path.join(siteDir, 'dist')}`);
        } catch (e: any) {
            this.error(`Build failed: ${e.message}`, 1);
        }
    }
}
