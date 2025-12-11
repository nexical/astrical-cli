import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BaseCommand } from '../../../src/core/BaseCommand.js';
import * as ConfigUtils from '../../../src/utils/config.js';
import { logger } from '../../../src/utils/logger.js';
import process from 'node:process';

vi.mock('../../../src/utils/config.js');
vi.mock('../../../src/utils/logger.js');

class TestCommand extends BaseCommand {
    async run() { }
}

class ProjectRequiredCommand extends BaseCommand {
    static requiresProject = true;
    async run() { }
}

describe('BaseCommand', () => {
    let processExitSpy: any;

    beforeEach(() => {
        vi.clearAllMocks();
        processExitSpy = vi.spyOn(process, 'exit').mockImplementation((() => { }) as any);
    });

    afterEach(() => {
        processExitSpy.mockRestore();
    });

    it('should initialize with default options', () => {
        const cmd = new TestCommand();
        expect((cmd as any).globalOptions).toEqual({});
        expect((cmd as any).projectRoot).toBeNull();
    });

    it('should use provided rootDir', async () => {
        const cmd = new TestCommand({ rootDir: '/custom/root' });
        await cmd.init();
        expect((cmd as any).projectRoot).toBe('/custom/root');
        expect(ConfigUtils.findProjectRoot).not.toHaveBeenCalled();
    });

    it('should find project root if not provided', async () => {
        (ConfigUtils.findProjectRoot as any).mockResolvedValue('/found/root');
        const cmd = new TestCommand({});
        await cmd.init();
        expect((cmd as any).projectRoot).toBe('/found/root');
    });

    it('should load config if project root exists', async () => {
        (ConfigUtils.findProjectRoot as any).mockResolvedValue('/found/root');
        (ConfigUtils.loadConfig as any).mockResolvedValue({ loaded: true });

        const cmd = new TestCommand({});
        await cmd.init();
        expect((cmd as any).config).toEqual({ loaded: true });
    });

    it('should error if project required but not found', async () => {
        (ConfigUtils.findProjectRoot as any).mockResolvedValue(null);

        const cmd = new ProjectRequiredCommand({});
        await cmd.init();

        expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('requires to be run within an Astrical project'));
        expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('should log success', () => {
        const cmd = new TestCommand();
        cmd.success('test');
        expect(logger.success).toHaveBeenCalledWith('test');
    });

    it('should log info', () => {
        const cmd = new TestCommand();
        cmd.info('test');
        expect(logger.info).toHaveBeenCalledWith('test');
    });

    it('should log warn', () => {
        const cmd = new TestCommand();
        cmd.warn('test');
        expect(logger.warn).toHaveBeenCalledWith('test');
    });

    it('should log error string and exit', () => {
        const cmd = new TestCommand();
        cmd.error('fail', 1);
        expect(logger.error).toHaveBeenCalledWith('fail');
        expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('should log error object and exit', () => {
        const cmd = new TestCommand();
        const err = new Error('fail');
        cmd.error(err, 2);
        expect(logger.error).toHaveBeenCalledWith('fail');
        expect(process.exit).toHaveBeenCalledWith(2);
    });

    it('should log error object stack in debug mode', () => {
        const cmd = new TestCommand({ debug: true });
        const err = new Error('fail');
        cmd.error(err);
        expect(logger.error).toHaveBeenCalledWith('fail');
        expect(logger.error).toHaveBeenCalledTimes(2); // One for message, one for stack
    });
    it('should skip config loading if project root is not found', async () => {
        (ConfigUtils.findProjectRoot as any).mockResolvedValue(null);
        const cmd = new TestCommand({});
        await cmd.init();
        expect((cmd as any).projectRoot).toBeNull();
        expect(ConfigUtils.loadConfig).not.toHaveBeenCalled();
        expect((cmd as any).config).toEqual({});
    });

    it('should set CLI instance', () => {
        const cmd = new TestCommand();
        const mockCli = { version: '1.0.0' };
        cmd.setCli(mockCli);
        expect((cmd as any).cli).toBe(mockCli);
    });
});
