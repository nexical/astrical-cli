
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import DevCommand from '../../../src/commands/dev.js';
import { logger } from '../../../src/utils/logger.js';
import cp from 'child_process';
import EventEmitter from 'events';

vi.mock('../../../src/utils/logger.js');
vi.mock('child_process');
// Mock the dynamic import of environment
vi.mock('../../../src/utils/environment.js', () => ({
    prepareEnvironment: vi.fn().mockResolvedValue(undefined)
}));

describe('DevCommand', () => {
    let command: DevCommand;
    let mockChild: any;

    beforeEach(async () => {
        vi.clearAllMocks();
        command = new DevCommand({ rootDir: '/mock/root' });

        // Mock spawn to return an event emitter
        mockChild = new EventEmitter();
        mockChild.kill = vi.fn();
        mockChild.stdout = new EventEmitter();
        mockChild.stderr = new EventEmitter();
        vi.mocked(cp.spawn).mockReturnValue(mockChild as any);

        // Mock process exit to avoid actual exit
        vi.spyOn(process, 'exit').mockImplementation((() => { }) as any);

        await command.init();
    });

    afterEach(() => {
        vi.resetAllMocks();
    });

    it('should have correct static properties', () => {
        expect(DevCommand.paths).toEqual([['dev']]);
        expect(DevCommand.usage).toBe('dev');
        expect(DevCommand.description).toBe('Starts the Astro development server with HMR.');
        expect(DevCommand.requiresProject).toBe(true);
    });

    it('should error if project root is missing', async () => {
        command = new DevCommand({ rootDir: undefined });
        await command.run();
        expect(logger.error).toHaveBeenCalledWith('Project root not found.');
    });

    it('should initialize environment and spawn astro dev', async () => {
        // Trigger close to resolve the promise
        setTimeout(() => {
            mockChild.emit('close', 0);
        }, 100);

        await command.run();

        const { prepareEnvironment } = await import('../../../src/utils/environment.js');
        expect(prepareEnvironment).toHaveBeenCalledWith('/mock/root');

        expect(cp.spawn).toHaveBeenCalledWith(
            expect.stringContaining('astro'),
            ['dev'],
            expect.objectContaining({
                cwd: expect.stringContaining('_site'),
                stdio: 'inherit'
            })
        );
    });

    it('should handle errors during initialization', async () => {
        const { prepareEnvironment } = await import('../../../src/utils/environment.js');
        vi.mocked(prepareEnvironment).mockRejectedValueOnce(new Error('Init failed'));

        // We need to finish the command execution somehow, or expect it to proceed?
        // In implementation: catch error, then log error. Then PROCEED to spawn.
        // So we need to mock close event too.
        setTimeout(() => {
            mockChild.emit('close', 0);
        }, 100);

        await command.run();

        expect(logger.error).toHaveBeenCalledWith('Init failed');
    });

    it('should handle spawn error', async () => {
        const runPromise = command.run();
        await new Promise(resolve => setTimeout(resolve, 0));

        mockChild.emit('error', new Error('Spawn failed'));
        mockChild.emit('close', 1);

        await runPromise;
        expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Failed to start Astro'));
    });

    it('should handle cleanup signals', async () => {
        const listeners: Record<string, Function> = {};
        vi.spyOn(process, 'on').mockImplementation((event: string | symbol, listener: any) => {
            listeners[event.toString()] = listener;
            return process;
        });

        setTimeout(() => {
            if (listeners['SIGINT']) listeners['SIGINT']();
            mockChild.emit('close', 0);
        }, 50);

        await command.run();
        expect(mockChild.kill).toHaveBeenCalled();
        expect(process.exit).toHaveBeenCalled();
    });
});
