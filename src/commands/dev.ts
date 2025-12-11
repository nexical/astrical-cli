
import { BaseCommand } from '../core/BaseCommand';
import fs from 'fs-extra';
import path from 'path';
import { spawn } from 'child_process';
import process from 'node:process';

export default class DevCommand extends BaseCommand {
    static paths = [['dev']];
    static usage = 'dev';
    static description = 'Starts the Astro development server with HMR.';
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

        this.info('Initializing ephemeral build environment...');

        try {
            const { prepareEnvironment } = await import('../utils/environment.js');
            await prepareEnvironment(this.projectRoot);
        } catch (error: any) {
            this.error(error);
            return;
        }

        // 6. Create src/env.d.ts if it doesn't exist (Astro needs it) or other critical files?
        // Usually handled by core, but let's assume core has it.

        this.success('Environment ready. Starting Astro...');

        // 7. Spawn Astro
        const child = spawn('npx', ['astro', 'dev'], {
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

        // Handle process termination to kill child
        const cleanup = () => {
            child.kill();
            process.exit();
        };

        process.on('SIGINT', cleanup);
        process.on('SIGTERM', cleanup);

        // Wait for child to exit
        await new Promise<void>((resolve) => {
            child.on('close', (code) => {
                if (code !== 0) {
                    // don't error hard, just exit
                }
                resolve();
            });
        });
    }
}
