
import { BaseCommand } from '../core/BaseCommand';
import fs from 'fs-extra';
import path from 'path';
import { spawn } from 'child_process';
import process from 'node:process';

export default class BuildCommand extends BaseCommand {
    static paths = [['build']];
    static usage = 'build';
    static description = 'Builds the production site.';
    static requiresProject = true;

    async run() {
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

        this.info('Building for production...');

        // 1. Clean _site
        await fs.remove(siteDir);
        await fs.ensureDir(siteDir);

        // 2. Copy Core contents
        if (await fs.pathExists(coreDir)) {
            // fs.copy copies the directory itself if we do fs.copy(coreDir, siteDir) which is wrong if siteDir exists
            // We want contents of coreDir into siteDir
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

        // 6. Spawn Astro
        const child = spawn('npx', ['astro', 'build'], {
            cwd: siteDir,
            stdio: 'inherit',
            env: {
                ...process.env,
                FORCE_COLOR: '1'
            }
        });

        child.on('error', (err) => {
            this.error(`Failed to start Astro: ${err.message}`);
        });

        await new Promise<void>((resolve) => {
            child.on('close', (code) => {
                if (code !== 0) {
                    this.error('Build failed', code || 1);
                } else {
                    this.success('Build completed successfully.');
                    this.success(`Output generated at ${path.join(siteDir, 'dist')}`);
                }
                resolve();
            });
        });
    }
}
