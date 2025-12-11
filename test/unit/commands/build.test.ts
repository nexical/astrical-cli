
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import BuildCommand from '../../../src/commands/build.js';
import { logger } from '../../../src/utils/logger.js';
import fs from 'fs-extra';
import cp from 'child_process';
import EventEmitter from 'events';

vi.mock('../../../src/utils/logger.js');
vi.mock('fs-extra');
vi.mock('child_process');

describe('BuildCommand', () => {
    let command: BuildCommand;
    let mockChild: any;

    beforeEach(async () => {
        vi.clearAllMocks();
        command = new BuildCommand({ rootDir: '/mock/root' });

        mockChild = new EventEmitter();
        mockChild.stdout = new EventEmitter();
        mockChild.stderr = new EventEmitter();
        vi.mocked(cp.spawn).mockReturnValue(mockChild as any);

        vi.mocked(fs.pathExists).mockResolvedValue(true);
        vi.spyOn(process, 'exit').mockImplementation((() => { }) as any);
        await command.init();
    });

    afterEach(() => {
        vi.resetAllMocks();
    });

    it('should have correct static properties', () => {
        expect(BuildCommand.paths).toEqual([['build']]);
        expect(BuildCommand.usage).toBe('build');
        expect(BuildCommand.description).toBe('Builds the production site.');
        expect(BuildCommand.requiresProject).toBe(true);
    });

    it('should error if project root is missing', async () => {
        command = new BuildCommand({ rootDir: undefined });
        await command.run();
        expect(logger.error).toHaveBeenCalledWith('Project root not found.');
    });

    it('should error if core directory is missing', async () => {
        vi.mocked(fs.pathExists).mockImplementation(async (p: string) => {
            return !p.includes('src/core');
        });
        await command.run();
        expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Core directory not found'));
    });

    it('should clean, copy files, and spawn astro build', async () => {
        setTimeout(() => {
            mockChild.emit('close', 0);
        }, 10);

        await command.run();

        expect(fs.remove).toHaveBeenCalledWith(expect.stringContaining('_site'));
        expect(fs.ensureDir).toHaveBeenCalledWith(expect.stringContaining('_site'));
        expect(fs.copy).toHaveBeenCalledTimes(4); // Core, Modules, Content, Public

        expect(cp.spawn).toHaveBeenCalledWith('npx', ['astro', 'build'], expect.objectContaining({
            cwd: expect.stringContaining('_site')
        }));

        // Verify filter function
        const copyCalls = vi.mocked(fs.copy).mock.calls;
        const coreCopyCall = copyCalls.find(call => call[0].toString().includes('core'));
        expect(coreCopyCall).toBeDefined();
        const filterFn = (coreCopyCall![2] as any).filter;
        expect(filterFn('some/path')).toBe(true);
        expect(filterFn('some/node_modules/path')).toBe(false);

        expect(logger.success).toHaveBeenCalledWith(expect.stringContaining('Build completed'));
    });

    it('should handle build failure', async () => {
        setTimeout(() => {
            mockChild.emit('close', 1);
        }, 10);

        await command.run();

        expect(logger.error).toHaveBeenCalledWith('Build failed');
        expect(logger.error).toHaveBeenCalledWith('Build failed');
        expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('should handle null exit code', async () => {
        setTimeout(() => {
            mockChild.emit('close', null);
        }, 10);
        await command.run();
        expect(logger.error).toHaveBeenCalledWith('Build failed');
        expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('should handle spawn error', async () => {
        const runPromise = command.run();

        // Allow event loop to tick
        await new Promise(resolve => setTimeout(resolve, 0));

        mockChild.emit('error', new Error('Spawn failed'));
        // We must emit close to resolve the run promise
        mockChild.emit('close', 1);

        await runPromise;
        expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Failed to start Astro'));
    });

    it('should skip copying if path does not exist', async () => {
        vi.mocked(fs.pathExists).mockImplementation(async (p: string) => {
            // Simulate core exists, others don't
            if (p.includes('core')) return true;
            return false;
        });

        setTimeout(() => { mockChild.emit('close', 0); }, 10);
        await command.run();

        expect(fs.copy).toHaveBeenCalledTimes(1); // Only core
    });
});
