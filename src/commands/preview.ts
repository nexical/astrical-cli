
import { BaseCommand } from '../core/BaseCommand';
import fs from 'fs-extra';
import path from 'path';
import { spawn } from 'child_process';
import process from 'node:process';

export default class PreviewCommand extends BaseCommand {
    static paths = [['preview']];
    static usage = 'preview';
    static description = 'Preview the production build locally.';
    static requiresProject = true;

    async run() {
        if (!this.projectRoot) {
            this.error('Project root not found.');
            return;
        }

        const siteDir = path.resolve(this.projectRoot, '_site');
        const distDir = path.join(siteDir, 'dist');

        if (!(await fs.pathExists(distDir))) {
            this.error("Please run 'astrical build' first.");
            return;
        }

        this.info('Starting preview server...');

        const astroBin = path.join(this.projectRoot, 'node_modules', '.bin', 'astro');

        const child = spawn(astroBin, ['preview'], {
            cwd: siteDir,
            stdio: 'inherit',
            env: {
                ...process.env,
                FORCE_COLOR: '1'
            }
        });

        child.on('error', (err) => {
            this.error(`Failed to start preview: ${err.message}`);
        });

        // Handle process termination to kill child
        const cleanup = () => {
            child.kill();
            process.exit();
        };

        process.on('SIGINT', cleanup);
        process.on('SIGTERM', cleanup);

        await new Promise<void>((resolve) => {
            child.on('close', (code) => {
                if (code !== 0) {
                    // exit
                }
                resolve();
            });
        });
    }
}
