import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { logger } from './logger.js';

const execAsync = promisify(exec);

export async function runCommand(command: string, cwd?: string): Promise<void> {
    try {
        await execAsync(command, { cwd });
    } catch (error: any) {
        logger.error(`Command failed: ${command}`);
        if (error.stderr) {
            logger.error(error.stderr);
        }
        throw new Error(`Command failed: ${command}`);
    }
}
