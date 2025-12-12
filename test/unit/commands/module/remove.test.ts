
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import ModuleRemoveCommand from '../../../../src/commands/module/remove.js';
import { logger } from '../../../../core/src/utils/logger.js';
import * as shell from '../../../../core/src/utils/shell.js';
import fs from 'fs-extra';

vi.mock('../../../../core/src/utils/logger.js');
vi.mock('../../../../core/src/utils/shell.js');
vi.mock('fs-extra');

describe('ModuleRemoveCommand', () => {
    let command: ModuleRemoveCommand;

    beforeEach(async () => {
        vi.clearAllMocks();
        command = new ModuleRemoveCommand({ rootDir: '/mock/root' });
        vi.mocked(fs.pathExists).mockResolvedValue(true);
        vi.spyOn(process, 'exit').mockImplementation((() => { }) as any);
        await command.init();
    });

    afterEach(() => {
        vi.resetAllMocks();
    });

    it('should have correct static properties', () => {
        expect(ModuleRemoveCommand.paths).toEqual([['module', 'remove']]);
        expect(ModuleRemoveCommand.usage).toContain('module remove');
        expect(ModuleRemoveCommand.description).toBeDefined();
        expect(ModuleRemoveCommand.requiresProject).toBe(true);
        expect(ModuleRemoveCommand.args).toBeDefined();
    });

    it('should error if project root is missing', async () => {
        command = new ModuleRemoveCommand({ rootDir: undefined });
        await command.run('mod');
        expect(logger.error).toHaveBeenCalledWith('Project root not found.');
    });

    it('should remove submodule and sync', async () => {
        await command.run('mod');

        expect(shell.runCommand).toHaveBeenCalledWith(expect.stringContaining('git submodule deinit'), '/mock/root');
        expect(shell.runCommand).toHaveBeenCalledWith(expect.stringContaining('git rm'), '/mock/root');
        expect(fs.remove).toHaveBeenCalledWith(expect.stringContaining('.git/modules'));
        expect(shell.runCommand).toHaveBeenCalledWith('npm install', '/mock/root');
    });

    it('should error if module not found', async () => {
        vi.mocked(fs.pathExists).mockResolvedValue(false);
        await command.run('missing');
        expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('not found'));
    });

    it('should handle failure during remove', async () => {
        vi.mocked(shell.runCommand).mockRejectedValue(new Error('Git remove failed'));
        await command.run('mod');
        expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Failed to remove module'));
    });

    it('should skip .git/modules cleanup if not found', async () => {
        vi.mocked(fs.pathExists).mockImplementation(async (p: string) => {
            if (p.includes('.git/modules')) return false;
            return true;
        });
        await command.run('mod');
        expect(fs.remove).not.toHaveBeenCalledWith(expect.stringContaining('.git/modules'));
    });
});
