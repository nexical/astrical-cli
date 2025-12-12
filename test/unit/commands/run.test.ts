
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import RunCommand from '../../../src/commands/run.js';
import fs from 'fs-extra';
import cp from 'child_process';
import EventEmitter from 'events';
import { logger } from '../../../core/src/utils/logger.js';
import process from 'node:process';

vi.mock('../../../core/src/utils/logger.js');
vi.mock('fs-extra');
vi.mock('child_process');
vi.mock('../../../core/src/utils/environment.js', () => ({
    prepareEnvironment: vi.fn().mockResolvedValue(undefined)
}));

describe('RunCommand', () => {
    let command: RunCommand;
    let mockChild: any;
    let mockExit: any;

    beforeEach(async () => {
        vi.clearAllMocks();
        command = new RunCommand({ rootDir: '/mock/root' });

        mockChild = new EventEmitter();
        mockChild.kill = vi.fn();
        mockChild.stdout = new EventEmitter();
        mockChild.stderr = new EventEmitter();
        vi.mocked(cp.spawn).mockReturnValue(mockChild as any);

        await command.init();
        mockExit = vi.spyOn(process, 'exit').mockImplementation((() => { }) as any);
    });

    afterEach(() => {
        vi.resetAllMocks();
    });

    it('should have correct static properties', () => {
        expect(RunCommand.paths).toEqual([['run']]);
        expect(RunCommand.usage).toBe('run <script> [args...]');
        expect(RunCommand.requiresProject).toBe(true);
        expect(RunCommand.args).toBeDefined();
    });

    it('should error if project root is missing', async () => {
        command = new RunCommand({ rootDir: undefined });
        await command.run('script', {});
        expect(logger.error).toHaveBeenCalledWith('Project root not found.');
    });

    it('should error if script is missing', async () => {
        await command.run(undefined as any, {});
        expect(logger.error).toHaveBeenCalledWith('Please specify a script to run.');
    });

    it('should run core script via npm', async () => {
        setTimeout(() => {
            mockChild.emit('close', 0);
        }, 10);

        // run(script, options)
        await command.run('test', {});

        const { prepareEnvironment } = await import('../../../src/utils/environment.js');
        expect(prepareEnvironment).toHaveBeenCalled();

        expect(cp.spawn).toHaveBeenCalledWith('npm', ['run', 'test', '--'], expect.objectContaining({
            cwd: expect.stringContaining('_site')
        }));
    });

    it('should run module script if resolved', async () => {
        vi.mocked(fs.pathExists).mockImplementation(async (p: string) => {
            return p.includes('stripe/package.json') || p.includes('stripe') || p.includes('core');
        });
        vi.mocked(fs.readJson).mockResolvedValue({
            scripts: {
                sync: 'node scripts/sync.js'
            }
        });

        setTimeout(() => {
            mockChild.emit('close', 0);
        }, 10);

        await command.run('stripe:sync', '--flag', {});

        // Expect shell execution of raw command
        const expectedCmd = process.platform === 'win32' ? 'cmd' : 'sh';
        expect(cp.spawn).toHaveBeenCalledWith(expectedCmd, expect.arrayContaining([
            expect.stringContaining('node scripts/sync.js --flag')
        ]), expect.objectContaining({
            cwd: expect.stringContaining('_site')
        }));
    });

    it('should handle module script read error', async () => {
        vi.mocked(fs.pathExists).mockImplementation(async (p: string) => {
            return p.includes('stripe'); // module exists
        });
        vi.mocked(fs.readJson).mockImplementation(async () => {
            throw new Error('Read failed');
        });

        setTimeout(() => {
            mockChild.emit('close', 0);
        }, 10);

        await command.run('stripe:sync', {});

        expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Failed to read package.json'));
    });

    it('should ignore module script if package.json missing', async () => {
        vi.mocked(fs.pathExists).mockImplementation(async (p: string) => {
            return p.includes('stripe') && !p.includes('package.json');
        });

        setTimeout(() => { mockChild.emit('close', 0); }, 10);
        await command.run('stripe:sync', {});

        // Should fall through to npm run
        expect(cp.spawn).toHaveBeenCalledWith('npm', expect.arrayContaining(['run', 'stripe:sync']), expect.anything());
    });

    it('should handle cleanup signals', async () => {
        const listeners: Record<string, Function> = {};
        vi.spyOn(process, 'on').mockImplementation((event: string | symbol, listener: any) => {
            listeners[event.toString()] = listener;
            return process;
        });

        const runPromise = command.run('test', {});
        await new Promise(resolve => setTimeout(resolve, 0));

        // Simulate signal by calling listener directly
        if (listeners['SIGINT']) listeners['SIGINT']();
        mockChild.emit('close', 0);

        await runPromise;

        expect(mockExit).toHaveBeenCalled();
    });

    it('should handle non-zero exit code', async () => {
        setTimeout(() => {
            mockChild.emit('close', 1);
        }, 10);
        await command.run('test', {});
        expect(mockExit).toHaveBeenCalledWith(1);
    });

    it('should use cmd on windows for module scripts', async () => {
        const originalPlatform = process.platform;
        Object.defineProperty(process, 'platform', { value: 'win32' });

        vi.mocked(fs.pathExists).mockImplementation(async (p: string) => {
            return p.includes('stripe');
        });
        vi.mocked(fs.readJson).mockResolvedValue({
            scripts: { sync: 'node scripts/sync.js' }
        });

        setTimeout(() => { mockChild.emit('close', 0); }, 10);
        await command.run('stripe:sync', {});

        expect(cp.spawn).toHaveBeenCalledWith('cmd', expect.arrayContaining(['/c', expect.stringContaining('node scripts/sync.js')]), expect.anything());

        Object.defineProperty(process, 'platform', { value: originalPlatform });
    });
    it('should fall back to default behavior if script not found in module', async () => {
        vi.mocked(fs.pathExists).mockImplementation(async (p: string) => {
            return p.includes('src/modules/mymod') || p.includes('package.json');
        });
        vi.mocked(fs.readJson).mockResolvedValue({
            name: 'mymod',
            scripts: { other: 'command' }
        });

        setTimeout(() => { mockChild.emit('close', 0); }, 10);
        await command.run('mymod:missing', {});

        // Should NOT run module script logic (no "Running module script" log)
        expect(logger.info).not.toHaveBeenCalledWith(expect.stringContaining('Running module script'));
        expect(cp.spawn).toHaveBeenCalledWith('npm', ['run', 'mymod:missing', '--'], expect.any(Object));
    });

    it('should handle null exit code', async () => {
        setTimeout(() => {
            mockChild.emit('close', null);
        }, 10);
        await command.run('sc', {});
        expect(mockExit).toHaveBeenCalledWith(1);
    });
});
