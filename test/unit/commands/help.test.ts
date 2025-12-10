import { describe, it, expect, vi, beforeEach } from 'vitest';
import HelpCommand from '../../../src/commands/help.js';
import { BaseCommand } from '../../../src/core/BaseCommand.js';

// Mock logger
vi.mock('../../../src/utils/logger.js', () => ({
    logger: {
        success: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    }
}));

import { logger } from '../../../src/utils/logger.js';

// Mock picocolors to return strings as-is for easy assertion
vi.mock('picocolors', () => ({
    default: {
        bold: (s: string) => s,
        cyan: (s: string) => s,
        yellow: (s: string) => s,
        dim: (s: string) => s,
        red: (s: string) => s,
    }
}));

describe('HelpCommand', () => {
    let mockCli: any;
    let mockRawCli: any;
    let consoleLogSpy: any;
    let processExitSpy: any;

    beforeEach(() => {
        vi.clearAllMocks();

        consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => { });
        processExitSpy = vi.spyOn(process, 'exit').mockImplementation(() => { throw new Error('EXIT'); });

        mockRawCli = {
            outputHelp: vi.fn(),
            commands: []
        };

        mockCli = {
            getCommands: vi.fn(),
            getRawCLI: vi.fn().mockReturnValue(mockRawCli)
        };
    });

    it('should display global help if no args provided', async () => {
        const cmd = new HelpCommand();
        cmd.setCli(mockCli);

        // Mock commands for global list
        mockCli.getCommands.mockReturnValue([
            { command: 'init', class: { description: 'Init desc' } },
            { command: 'undocumented', class: { description: undefined } } // No desc
        ]);

        await cmd.run({ command: [] }); // No args

        // expect(mockRawCli.outputHelp).toHaveBeenCalled(); // No longer called
        expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Usage: astrical'));
        expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Commands:'));
        expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('init'));
        expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Init desc'));
        expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('undocumented'));
        expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('--help'));
    });

    it('should handle undefined command option safely', async () => {
        const cmd = new HelpCommand();
        cmd.setCli(mockCli);

        // Mock commands
        mockCli.getCommands.mockReturnValue([]);

        await cmd.run({}); // No options object keys

        // expect(mockRawCli.outputHelp).toHaveBeenCalled();
        expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Usage: astrical'));
    });

    it('should display exact command help if matched', async () => {
        const cmd = new HelpCommand();
        cmd.setCli(mockCli);

        // Mock loaded commands with args definition
        mockCli.getCommands.mockReturnValue([
            {
                command: 'init',
                class: {
                    description: 'Initialize project',
                    args: {
                        args: [
                            { name: 'name', description: 'Project Name', required: true },
                            { name: 'optional', description: undefined, required: false }
                        ]
                    }
                }
            }
        ]);

        // Mock CAC commands structure
        mockRawCli.commands = [
            {
                name: 'init',
                rawName: 'init <name>',
                description: 'Initialize project',
                options: [
                    { name: 'force', rawName: '--force', description: 'Force overwrite', config: { default: false } }
                ]
            }
        ];

        await cmd.run({ command: ['init'] });

        // Should not call global help
        expect(mockRawCli.outputHelp).not.toHaveBeenCalled();

        // Should print usage
        expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Usage: init <name>'));
        expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Initialize project'));
        // Arguments
        expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Arguments:'));
        expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Project Name'));
        expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('(required)'));
        expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('optional'));
        // Options
        expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('--force'));
    });

    it('should handle registry discrepancy (loader has it, CAC does not)', async () => {
        const cmd = new HelpCommand();
        cmd.setCli(mockCli);

        mockCli.getCommands.mockReturnValue([{ command: 'ghost', class: {} }]);
        mockRawCli.commands = []; // CAC doesn't know about it

        await cmd.run({ command: ['ghost'] });

        // Should return without printing specific help, because cacCmd is missing
        expect(consoleLogSpy).not.toHaveBeenCalledWith(expect.stringContaining('Usage:'));
    });

    it('should display command help with options having defaults', async () => {
        const cmd = new HelpCommand();
        cmd.setCli(mockCli);

        mockCli.getCommands.mockReturnValue([{ command: 'build', class: {} }]);
        mockRawCli.commands = [{
            name: 'build',
            rawName: 'build',
            description: 'Build project',
            options: [
                { name: 'out', rawName: '--out', description: 'Output', config: { default: 'dist' } },
                { name: 'quiet', rawName: '--quiet', description: undefined, config: {} } // No description option
            ]
        }];

        await cmd.run({ command: ['build'] });

        expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('(default: dist)'));
        expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('--quiet'));
    });

    it('should display command help without options', async () => {
        const cmd = new HelpCommand();
        cmd.setCli(mockCli);

        mockCli.getCommands.mockReturnValue([{ command: 'info', class: {} }]);
        mockRawCli.commands = [{
            name: 'info',
            rawName: 'info',
            description: 'Info',
            options: [] // No options
        }];

        await cmd.run({ command: ['info'] });

        expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Info'));
        expect(consoleLogSpy).not.toHaveBeenCalledWith(expect.stringContaining('Options:'));
    });

    it('should display namespace commands', async () => {
        const cmd = new HelpCommand();
        cmd.setCli(mockCli);

        mockCli.getCommands.mockReturnValue([
            { command: 'module add', class: { description: 'Add module' } },
            { command: 'module remove', class: { description: 'Remove module' } },
            { command: 'module secret', class: {} }, // No description
            { command: 'init', class: {} }
        ]);

        await cmd.run({ command: ['module'] });

        expect(mockRawCli.outputHelp).not.toHaveBeenCalled();
        expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Commands for module:'));
        expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('module add'));
        expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('module add'));
        expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('module remove'));
        expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('module secret'));
        expect(consoleLogSpy).not.toHaveBeenCalledWith(expect.stringContaining('init'));
    });

    it('should error on unknown command', async () => {
        const cmd = new HelpCommand();
        cmd.setCli(mockCli);

        mockCli.getCommands.mockReturnValue([]);

        try {
            await cmd.run({ command: ['unknown'] });
        } catch (e: any) {
            expect(e.message).toBe('EXIT');
        }

        expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Unknown command: unknown'));
    });
});
