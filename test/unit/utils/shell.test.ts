import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { runCommand } from '../../../src/utils/shell.js';
import { logger } from '../../../src/utils/logger.js';
import * as cp from 'node:child_process';

vi.mock('../../../src/utils/logger.js');
vi.mock('node:child_process', async () => {
    return {
        exec: vi.fn(),
    };
});

describe('shell utils', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.resetAllMocks();
    });

    it('should execute command successfully', async () => {
        const mockExec = vi.mocked(cp.exec);
        mockExec.mockImplementation(((cmd: string, options: any, cb: any) => {
            const callback = cb || options;
            callback(null, 'stdout output', '');
            return {} as any;
        }) as any);

        await runCommand('ls -la');

        expect(mockExec).toHaveBeenCalledWith('ls -la', expect.anything(), expect.anything());
    });

    it('should pass cwd to exec', async () => {
        const mockExec = vi.mocked(cp.exec);
        mockExec.mockImplementation(((cmd: string, options: any, cb: any) => {
            const callback = cb || options;
            callback(null, 'stdout', '');
            return {} as any;
        }) as any);

        await runCommand('ls', '/tmp');

        expect(mockExec).toHaveBeenCalledWith('ls', expect.objectContaining({ cwd: '/tmp' }), expect.anything());
    });

    it('should handle execution errors', async () => {
        const error: any = new Error('Shell Error');
        error.code = 1;

        const mockExec = vi.mocked(cp.exec);
        mockExec.mockImplementation(((cmd: string, options: any, cb: any) => {
            const callback = cb || options;
            callback(error, '', 'stderr output');
            return {} as any;
        }) as any);

        await expect(runCommand('fail')).rejects.toThrow('Command failed: fail');

        expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Command failed'));
    });

    it('should log stderr if available on error', async () => {
        const error: any = new Error('Shell Error');
        error.stderr = 'Some serious shell error';

        const mockExec = vi.mocked(cp.exec);
        mockExec.mockImplementation(((cmd: string, options: any, cb: any) => {
            const callback = cb || options;
            callback(error, '', 'stderr output');
            return {} as any;
        }) as any);

        await expect(runCommand('fail')).rejects.toThrow();
        expect(logger.error).toHaveBeenCalledWith('Some serious shell error');
    });
});
