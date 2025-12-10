import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import InitCommand from '../../../src/commands/init.js';
import { logger } from '../../../src/utils/logger.js';
import * as gitUtils from '../../../src/utils/git.js';
import fs from 'node:fs';
import path from 'node:path';

vi.mock('../../../src/utils/logger.js');
vi.mock('../../../src/utils/git.js');
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
        expect(gitUtils.runCommand).toHaveBeenCalledWith(
            expect.stringContaining('git clone --recursive https://default.com/repo .'),
            expect.stringContaining(targetDir)
        );

        // Submodules
        expect(gitUtils.runCommand).toHaveBeenCalledWith(
            expect.stringContaining('submodule foreach'),
            expect.stringContaining(targetDir)
        );

        // Npm install
        expect(gitUtils.runCommand).toHaveBeenCalledWith(
            'npm install',
            expect.stringContaining(targetDir)
        );

        // History wipe
        expect(gitUtils.runCommand).toHaveBeenCalledWith(
            expect.stringContaining('git checkout --orphan'),
            expect.stringContaining(targetDir)
        );
        expect(gitUtils.runCommand).toHaveBeenCalledWith(
            expect.stringContaining('git remote remove origin'),
            expect.stringContaining(targetDir)
        );

        expect(logger.success).toHaveBeenCalledWith(expect.stringContaining('successfully'));
    });

    it('should handle gh@ syntax', async () => {
        const targetDir = 'gh-project';
        await command.run({ directory: targetDir, repo: 'gh@nexical/astrical-starter' });

        expect(gitUtils.runCommand).toHaveBeenCalledWith(
            expect.stringContaining('git clone --recursive https://github.com/nexical/astrical-starter.git .'),
            expect.stringContaining(targetDir)
        );
    });

    it('should fail if directory exists and is not empty', async () => {
        vi.mocked(fs.existsSync).mockReturnValue(true);
        vi.mocked(fs.readdirSync).mockReturnValue(['file.txt'] as any);

        await expect(command.run({ directory: 'existing-dir', repo: 'foo' }))
            .rejects.toThrow('Process.exit(1)');

        expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('not empty'));
    });

    it('should proceed if directory exists but is empty', async () => {
        vi.mocked(fs.existsSync).mockReturnValue(true);
        vi.mocked(fs.readdirSync).mockReturnValue([]);

        // Mock process.exit to ensure it's NOT called
        // We can check that by ensuring run resolves successfully (or throws a differnet error later if git mock isn't set up for this specific flow, but we can reuse default git mocks)

        await command.run({ directory: 'empty-dir', repo: 'foo' });

        expect(fs.mkdirSync).not.toHaveBeenCalled(); // Should assume dir exists
        expect(gitUtils.runCommand).toHaveBeenCalledWith(
            expect.stringContaining('git clone'),
            expect.stringContaining('empty-dir')
        );
    });

    it('should handle git errors gracefully', async () => {
        vi.mocked(gitUtils.runCommand).mockRejectedValueOnce(new Error('Git fail'));

        await expect(command.run({ directory: 'fail-project', repo: 'foo' }))
            .rejects.toThrow('Process.exit(1)');

        expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Failed to initialize project'));
    });
});
