
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import ModuleAddCommand from '../../../../src/commands/module/add.js';
import { logger } from '../../../../src/utils/logger.js';
import * as shell from '../../../../src/utils/shell.js';
import fs from 'fs-extra';

vi.mock('../../../../src/utils/logger.js');
vi.mock('../../../../src/utils/shell.js');
vi.mock('fs-extra');

describe('ModuleAddCommand', () => {
    let command: ModuleAddCommand;

    beforeEach(async () => {
        vi.clearAllMocks();
        command = new ModuleAddCommand({ rootDir: '/mock/root' });
        vi.mocked(fs.pathExists).mockResolvedValue(false);
        vi.spyOn(process, 'exit').mockImplementation((() => { }) as any);
        await command.init();
    });

    afterEach(() => {
        vi.resetAllMocks();
    });

    it('should have correct static properties', () => {
        expect(ModuleAddCommand.paths).toEqual([['module', 'add']]);
        expect(ModuleAddCommand.usage).toContain('module add');
        expect(ModuleAddCommand.description).toBeDefined();
        expect(ModuleAddCommand.requiresProject).toBe(true);
        expect(ModuleAddCommand.args).toBeDefined();
    });

    it('should error if project root is missing', async () => {
        command = new ModuleAddCommand({ rootDir: undefined });
        await command.run('arg');
        expect(logger.error).toHaveBeenCalledWith('Project root not found.');
    });

    it('should error if url is missing', async () => {
        await command.run(undefined as any);
        expect(logger.error).toHaveBeenCalledWith('Please specify a repository URL.');
    });

    it('should add submodule and install dependencies', async () => {
        await command.run('https://git.com/repo.git', 'repo');

        expect(shell.runCommand).toHaveBeenCalledWith(
            expect.stringContaining('git submodule add https://git.com/repo.git src/modules/repo'),
            '/mock/root'
        );
        expect(shell.runCommand).toHaveBeenCalledWith('npm install', '/mock/root');
        expect(logger.success).toHaveBeenCalledWith(expect.stringContaining('added successfully'));
    });

    it('should expand gh@ syntax', async () => {
        await command.run('gh@org/repo', 'repo');
        expect(shell.runCommand).toHaveBeenCalledWith(
            expect.stringContaining('https://github.com/org/repo.git'),
            '/mock/root'
        );
    });

    it('should handled gh@ syntax with existing .git', async () => {
        await command.run('gh@org/repo.git', 'repo');
        expect(shell.runCommand).toHaveBeenCalledWith(
            expect.stringContaining('https://github.com/org/repo.git'),
            '/mock/root'
        );
    });

    it('should handle url ending with .git', async () => {
        await command.run('https://github.com/org/repo.git', 'repo');
        expect(shell.runCommand).toHaveBeenCalledWith(
            expect.stringContaining('https://github.com/org/repo.git'),
            '/mock/root'
        );
    });

    it('should infer name from url if not provided', async () => {
        await command.run('https://github.com/org/inferred.git');
        expect(shell.runCommand).toHaveBeenCalledWith(
            expect.stringContaining('src/modules/inferred'),
            '/mock/root'
        );
    });

    it('should handle runCommand failure', async () => {
        vi.mocked(shell.runCommand).mockRejectedValue(new Error('Git error'));
        await command.run('http://repo.git', 'repo');
        expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Failed to add module'));
    });

    it('should error if module already exists', async () => {
        vi.mocked(fs.pathExists).mockResolvedValue(true);
        await command.run('url', 'existing');
        expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('already exists'));
        expect(shell.runCommand).not.toHaveBeenCalled();
    });
});
