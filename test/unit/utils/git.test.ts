import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { runCommand } from '../../../src/utils/git.js';
import { logger } from '../../../src/utils/logger.js';
import * as cp from 'node:child_process';

vi.mock('../../../src/utils/logger.js');
// Mock the whole module
vi.mock('node:child_process', async () => {
    return {
        exec: vi.fn(),
    };
});

describe('git utils', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.resetAllMocks();
    });

    it('should execute command successfully', async () => {
        const mockExec = vi.mocked(cp.exec);
        mockExec.mockImplementation(((cmd: string, options: any, cb: any) => {
            // Support both (cmd, cb) and (cmd, opts, cb)
            const callback = cb || options;
            callback(null, 'stdout output', '');
            return {} as any;
        }) as any);

        await runCommand('git status');

        expect(mockExec).toHaveBeenCalledWith('git status', expect.anything(), expect.anything());
    });

    it('should pass cwd to exec', async () => {
        const mockExec = vi.mocked(cp.exec);
        mockExec.mockImplementation(((cmd: string, options: any, cb: any) => {
            const callback = cb || options;
            callback(null, 'stdout', '');
            return {} as any;
        }) as any);

        await runCommand('git status', '/tmp');

        expect(mockExec).toHaveBeenCalledWith('git status', expect.objectContaining({ cwd: '/tmp' }), expect.anything());
    });

    it('should handle execution errors', async () => {
        const error: any = new Error('Original Error');
        error.code = 127;

        const mockExec = vi.mocked(cp.exec);
        mockExec.mockImplementation(((cmd: string, options: any, cb: any) => {
            const callback = cb || options;
            callback(error, '', 'stderr output');
            return {} as any;
        }) as any);

        await expect(runCommand('invalid-command')).rejects.toThrow('Command failed: invalid-command');

        expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Command failed'));
    });

    it('should log stderr if available on error', async () => {
        const error: any = new Error('Git Error');
        error.stderr = 'Some serious git error';

        const mockExec = vi.mocked(cp.exec);
        mockExec.mockImplementation(((cmd: string, options: any, cb: any) => {
            const callback = cb || options;
            callback(error, '', 'stderr output');
            return {} as any;
        }) as any);

        await expect(runCommand('git fail')).rejects.toThrow();
        expect(logger.error).toHaveBeenCalledWith('Some serious git error');
    });
});
