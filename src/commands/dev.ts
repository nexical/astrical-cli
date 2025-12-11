
import { BaseCommand } from '../core/BaseCommand';
import fs from 'fs-extra';
import path from 'path';
import { spawn } from 'child_process';
import process from 'node:process';
import { logger } from '../utils/logger.js';

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

        this.info('Initializing ephemeral build environment...');

        try {
            const { prepareEnvironment } = await import('../utils/environment.js');
            logger.debug(`Preparing environment at: ${this.projectRoot}`);
            await prepareEnvironment(this.projectRoot);
        } catch (error: any) {
            this.error(error);
            return;
        }

        this.success('Environment ready. Starting Astro...');

        const astroBin = path.join(this.projectRoot, 'node_modules', '.bin', 'astro');
        logger.debug(`Spawning astro dev from: ${astroBin} in ${siteDir}`);

        const child = spawn(astroBin, ['dev'], {
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

        const cleanup = () => {
            child.kill();
            process.exit();
        };

        process.on('SIGINT', cleanup);
        process.on('SIGTERM', cleanup);

        await new Promise<void>((resolve) => {
            child.on('close', (code) => {
                resolve();
            });
        });
    }
}
