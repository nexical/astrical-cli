
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import ModuleUpdateCommand from '../../../../src/commands/module/update.js';
import { logger } from '../../../../src/utils/logger.js';
import * as shell from '../../../../src/utils/shell.js';
import fs from 'fs-extra';

vi.mock('../../../../src/utils/logger.js');
vi.mock('../../../../src/utils/shell.js');
vi.mock('fs-extra');

describe('ModuleUpdateCommand', () => {
    let command: ModuleUpdateCommand;

    beforeEach(async () => {
        vi.clearAllMocks();
        command = new ModuleUpdateCommand({ rootDir: '/mock/root' });
        vi.mocked(fs.pathExists).mockResolvedValue(true);
        vi.spyOn(process, 'exit').mockImplementation((() => { }) as any);
        await command.init();
    });

    afterEach(() => {
        vi.resetAllMocks();
    });

    it('should have correct static properties', () => {
        expect(ModuleUpdateCommand.paths).toEqual([['module', 'update']]);
        expect(ModuleUpdateCommand.usage).toContain('module update');
        expect(ModuleUpdateCommand.description).toBeDefined();
        expect(ModuleUpdateCommand.requiresProject).toBe(true);
        expect(ModuleUpdateCommand.args).toBeDefined();
    });

    it('should error if project root is missing', async () => {
        command = new ModuleUpdateCommand({ rootDir: undefined });
        await command.run();
        expect(logger.error).toHaveBeenCalledWith('Project root not found.');
    });

    it('should update all modules if no name provided', async () => {
        await command.run();
        expect(shell.runCommand).toHaveBeenCalledWith(
            expect.stringContaining('git submodule update --remote'),
            '/mock/root'
        );
        expect(shell.runCommand).toHaveBeenCalledWith('npm install', '/mock/root');
    });

    it('should update specific module', async () => {
        await command.run('mod');
        expect(shell.runCommand).toHaveBeenCalledWith(
            expect.stringContaining('git submodule update --remote --merge src/modules/mod'),
            '/mock/root'
        );
    });

    it('should handle failure during update', async () => {
        vi.mocked(shell.runCommand).mockRejectedValue(new Error('Update failed'));
        await command.run();
        expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Failed to update'));
    });

    it('should error if module to update not found', async () => {
        vi.mocked(fs.pathExists).mockResolvedValue(false);
        await command.run('missing-mod');
        expect(logger.error).toHaveBeenCalledWith('Module missing-mod not found.');
    });
});
