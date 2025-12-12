import { runCommand } from '../core/src/utils/shell.js';
import { logger } from '../core/src/utils/logger.js';

export async function clone(url: string, destination: string, recursive = false): Promise<void> {
    const cmd = `git clone ${recursive ? '--recursive ' : ''}${url} .`;
    logger.debug(`Git clone: ${url} to ${destination}`);
    await runCommand(cmd, destination);
}

export async function updateSubmodules(cwd: string): Promise<void> {
    logger.debug(`Updating submodules in ${cwd}`);
    await runCommand('git submodule foreach --recursive "git checkout main && git pull origin main"', cwd);
}

export async function checkoutOrphan(branch: string, cwd: string): Promise<void> {
    await runCommand(`git checkout --orphan ${branch}`, cwd);
}

export async function addAll(cwd: string): Promise<void> {
    await runCommand('git add -A', cwd);
}

export async function commit(message: string, cwd: string): Promise<void> {
    // Escape quotes in message if needed, for now assuming simple messages
    await runCommand(`git commit -m "${message}"`, cwd);
}

export async function deleteBranch(branch: string, cwd: string): Promise<void> {
    await runCommand(`git branch -D ${branch}`, cwd);
}

export async function renameBranch(branch: string, cwd: string): Promise<void> {
    await runCommand(`git branch -m ${branch}`, cwd);
}

export async function removeRemote(remote: string, cwd: string): Promise<void> {
    await runCommand(`git remote remove ${remote}`, cwd);
}
