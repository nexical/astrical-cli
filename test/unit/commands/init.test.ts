import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import InitCommand from '../../../src/commands/init.js';
import { logger } from '../../../core/src/utils/logger.js';
import * as git from '../../../src/utils/git.js';
import * as shell from '../../../core/src/utils/shell.js';
import fs from 'node:fs';
import path from 'node:path';

vi.mock('../../../core/src/utils/logger.js');
vi.mock('../../../utils/git.js');
vi.mock('../../../core/src/utils/shell.js');
vi.mock('node:fs');

describe('InitCommand', () => {
    let command: InitCommand;
    // Spy on process.exit but rely on catching the error if it throws (default vitest behavior)
    // or mock it to throw a custom error we can check.
    let mockExit: any;

    beforeEach(() => {
        vi.clearAllMocks();
        command = new InitCommand({});
        // Default fs mocks
        vi.mocked(fs.existsSync).mockReturnValue(false);
        vi.mocked(fs.mkdirSync).mockReturnValue(undefined);
        vi.mocked(fs.readdirSync).mockReturnValue([]);

        // Mock process.exit to throw a known error so we can stop execution and verify it
        mockExit = vi.spyOn(process, 'exit').mockImplementation((code) => {
            throw new Error(`Process.exit(${code})`);
        });
    });

    afterEach(() => {
        vi.resetAllMocks();
    });

    it('should have correct metadata', () => {
        expect(InitCommand.description).toBeDefined();
        expect(InitCommand.args).toBeDefined();
        expect(InitCommand.requiresProject).toBe(false);
    });

    it('should initialize project with default repo', async () => {
        const targetDir = 'new-project';
        await command.run({ directory: targetDir, repo: 'https://default.com/repo' });

        expect(fs.mkdirSync).toHaveBeenCalledWith(expect.stringContaining(targetDir), { recursive: true });

        // Clone
        expect(git.clone).toHaveBeenCalledWith('https://default.com/repo', expect.stringContaining(targetDir), true);

        // Submodules
        expect(git.updateSubmodules).toHaveBeenCalledWith(expect.stringContaining(targetDir));

        // Npm install
        expect(shell.runCommand).toHaveBeenCalledWith(
            'npm install',
            expect.stringContaining(targetDir)
        );

        // History wipe
        expect(git.checkoutOrphan).toHaveBeenCalledWith('new-main', expect.stringContaining(targetDir));
        expect(git.addAll).toHaveBeenCalledWith(expect.stringContaining(targetDir));
        expect(git.commit).toHaveBeenCalledWith('Initial commit', expect.stringContaining(targetDir));
        expect(git.deleteBranch).toHaveBeenCalledTimes(2); // main and master
        expect(git.renameBranch).toHaveBeenCalledWith('main', expect.stringContaining(targetDir));
        expect(git.removeRemote).toHaveBeenCalledWith('origin', expect.stringContaining(targetDir));

        expect(logger.success).toHaveBeenCalledWith(expect.stringContaining('successfully'));
    });

    it('should handle gh@ syntax', async () => {
        const targetDir = 'gh-project';
        await command.run({ directory: targetDir, repo: 'gh@nexical/astrical-starter' });

        expect(git.clone).toHaveBeenCalledWith(
            'https://github.com/nexical/astrical-starter.git',
            expect.stringContaining(targetDir),
            true
        );
    });

    it('should proceed if directory exists but is empty', async () => {
        vi.mocked(fs.existsSync).mockReturnValue(true);
        vi.mocked(fs.readdirSync).mockReturnValue([]);

        await command.run({ directory: 'empty-dir', repo: 'foo' });

        expect(fs.mkdirSync).not.toHaveBeenCalled(); // Should assume dir exists
        expect(git.clone).toHaveBeenCalledWith('foo', expect.stringContaining('empty-dir'), true);
    });

    it('should fail if directory exists and is not empty', async () => {
        vi.mocked(fs.existsSync).mockReturnValue(true);
        vi.mocked(fs.readdirSync).mockReturnValue(['file.txt'] as any);

        await expect(command.run({ directory: 'existing-dir', repo: 'foo' }))
            .rejects.toThrow('Process.exit(1)');

        expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('not empty'));
    });

    it('should handle git errors gracefully', async () => {
        vi.mocked(git.clone).mockRejectedValueOnce(new Error('Git fail'));

        await expect(command.run({ directory: 'fail-project', repo: 'foo' }))
            .rejects.toThrow('Process.exit(1)');

        expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Failed to initialize project'));
    });
});
