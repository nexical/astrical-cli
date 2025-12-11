import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CLI } from '../../../src/core/CLI.js';
import { CommandLoader } from '../../../src/core/CommandLoader.js';
import { BaseCommand } from '../../../src/core/BaseCommand.js';
import { cac } from 'cac';
import fs from 'node:fs';
import path from 'node:path';

vi.mock('cac');
vi.mock('../../../src/core/CommandLoader.js');
vi.mock('node:fs');

class MockCommand extends BaseCommand {
    static description = 'Mock Desc';
    static args = {
        args: [{ name: 'arg1', required: true }, { name: 'arg2', required: false }],
        options: [{ name: '--opt', description: 'desc', default: 'val' }]
    };
    async run() { }
}

describe('CLI', () => {
    let mockCac: any;
    let mockCommand: any;
    let mockLoad: any;

    beforeEach(() => {
        vi.clearAllMocks();

        mockCommand = {
            option: vi.fn().mockReturnThis(),
            action: vi.fn(),
            allowUnknownOptions: vi.fn().mockReturnThis(), // Added this
        };

        mockCac = {
            command: vi.fn().mockReturnValue(mockCommand),
            help: vi.fn(),
            version: vi.fn(),
            parse: vi.fn(),
        };
        (cac as any).mockReturnValue(mockCac);

        mockLoad = vi.fn().mockResolvedValue([]);

        // Fix: mockImplementation must return a class or function that returns an object
        (CommandLoader as any).mockImplementation(function () {
            return {
                load: mockLoad
            };
        });
    });

    it('should start and load commands', async () => {
        const cli = new CLI();
        (fs.existsSync as any).mockReturnValue(true);

        await cli.start();

        expect(mockLoad).toHaveBeenCalled();
        expect(mockCac.help).toHaveBeenCalled();
        expect(mockCac.version).toHaveBeenCalled();
        expect(mockCac.parse).toHaveBeenCalled();
    });

    it('should search for commands in multiple directories', async () => {
        const cli = new CLI();
        (fs.existsSync as any)
            .mockReturnValueOnce(false)
            .mockReturnValueOnce(true); // second path found

        await cli.start();
        expect(fs.existsSync).toHaveBeenCalledTimes(2);
        expect(mockLoad).toHaveBeenCalled();
    });

    it('should register loaded commands', async () => {
        mockLoad.mockResolvedValue([
            { command: 'test', class: MockCommand, instance: new MockCommand() }
        ]);
        (fs.existsSync as any).mockReturnValue(true);

        const cli = new CLI();
        await cli.start();

        expect(mockCac.command).toHaveBeenCalledWith(
            expect.stringContaining('test <arg1> [arg2]'),
            'Mock Desc'
        );
        expect(mockCommand.option).toHaveBeenCalledWith('--opt', 'desc', { default: 'val' });
        expect(mockCommand.action).toHaveBeenCalled();
    });

    it('should handle command execution', async () => {
        mockLoad.mockResolvedValue([
            { command: 'test', class: MockCommand, instance: new MockCommand() }
        ]);
        (fs.existsSync as any).mockReturnValue(true);

        const cli = new CLI();
        await cli.start();

        const actionFn = mockCommand.action.mock.calls[0][0];

        const initSpy = vi.spyOn(MockCommand.prototype, 'init');
        const runSpy = vi.spyOn(MockCommand.prototype, 'run');

        // simulate cac calling action
        await actionFn('val1', 'val2', { opt: 'custom' });

        expect(initSpy).toHaveBeenCalled();
        expect(runSpy).toHaveBeenCalledWith(expect.objectContaining({
            arg1: 'val1',
            arg2: 'val2',
            opt: 'custom'
        }));
    });

    it('should handle command execution errors', async () => {
        mockLoad.mockResolvedValue([
            { command: 'test', class: MockCommand, instance: new MockCommand() }
        ]);
        (fs.existsSync as any).mockReturnValue(true);

        const cli = new CLI();
        await cli.start();

        const actionFn = mockCommand.action.mock.calls[0][0];

        vi.spyOn(MockCommand.prototype, 'init').mockRejectedValue(new Error('Init failed'));
        const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => { }) as any);
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { });

        await actionFn({}, {});

        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Init failed'));
        expect(exitSpy).toHaveBeenCalledWith(1);
    });

    it('should print stack trace in debug mode', async () => {
        mockLoad.mockResolvedValue([
            { command: 'test', class: MockCommand, instance: new MockCommand() }
        ]);
        (fs.existsSync as any).mockReturnValue(true);

        const cli = new CLI();
        await cli.start();

        const actionFn = mockCommand.action.mock.calls[0][0];

        vi.spyOn(MockCommand.prototype, 'init').mockRejectedValue(new Error('Init failed'));
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { });
        vi.spyOn(process, 'exit').mockImplementation((() => { }) as any);

        await actionFn({ debug: true });

        expect(consoleSpy).toHaveBeenCalledTimes(2); // message + stack
    });

    it('should handle parse errors', async () => {
        const cli = new CLI();
        (fs.existsSync as any).mockReturnValue(true);
        mockCac.parse.mockImplementation(() => { throw new Error('Parse error'); });

        const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => { }) as any);
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { });

        await cli.start();

        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Parse error'));
        expect(exitSpy).toHaveBeenCalledWith(1);
    });
    it('should handle positional arguments mapping', async () => {
        mockLoad.mockResolvedValue([
            { command: 'test', class: MockCommand, instance: new MockCommand() }
        ]);
        (fs.existsSync as any).mockReturnValue(true);

        const cli = new CLI();
        await cli.start();

        const actionFn = mockCommand.action.mock.calls[0][0];

        // Mock init to prevent real execution issues
        vi.spyOn(MockCommand.prototype, 'init').mockResolvedValue(undefined);
        const runSpy = vi.spyOn(MockCommand.prototype, 'run');

        // simulate cac calling action with positional args
        await actionFn('val1', 'val2', { opt: 'custom' });

        expect(runSpy).toHaveBeenCalledWith(expect.objectContaining({
            arg1: 'val1',
            arg2: 'val2',
            opt: 'custom'
        }));
    });

    it('should map positional args correctly when fewer provided', async () => {
        mockLoad.mockResolvedValue([
            { command: 'test', class: MockCommand, instance: new MockCommand() }
        ]);
        (fs.existsSync as any).mockReturnValue(true);

        const cli = new CLI();
        await cli.start();

        const actionFn = mockCommand.action.mock.calls[0][0];

        // Mock init here too
        vi.spyOn(MockCommand.prototype, 'init').mockResolvedValue(undefined);
        const runSpy = vi.spyOn(MockCommand.prototype, 'run');

        // Provide only 1 arg
        await actionFn('val1', { opt: 'default' });

        expect(runSpy).toHaveBeenCalledWith(expect.objectContaining({
            arg1: 'val1',
            opt: 'default'
        }));
        // arg2 should be undefined in options if not provided
    });

    it('should handle missing commands directory gracefully', async () => {
        (fs.existsSync as any).mockReturnValue(false);
        const cli = new CLI();
        // Should not throw
        await cli.start();
        expect(mockLoad).toHaveBeenCalledWith('');
    });

    it('should register command without args or options', async () => {
        class SimpleCommand extends BaseCommand {
            static description = undefined as unknown as string; // Cover missing description
            async run() { }
        }

        mockLoad.mockResolvedValue([
            { command: 'simple', class: SimpleCommand, instance: new SimpleCommand() }
        ]);
        (fs.existsSync as any).mockReturnValue(true);

        const cli = new CLI();
        await cli.start();

        expect(mockCac.command).toHaveBeenCalledWith('simple', '');
    });
    it('should register command with options but no positional args', async () => {
        class NoArgsCommand extends BaseCommand {
            static args = {
                options: [{ name: '--flag', description: 'flag', default: false }]
            }; // No 'args' array
            async run() { }
        }

        mockLoad.mockResolvedValue([
            { command: 'noargs', class: NoArgsCommand, instance: new NoArgsCommand() }
        ]);
        (fs.existsSync as any).mockReturnValue(true);

        const cli = new CLI();
        await cli.start();

        const actionFn = mockCommand.action.mock.calls[0][0];

        // This should trigger the line 85 check (argsDef.args is undefined)
        await actionFn({}, { flag: true });

        expect(mockCommand.option).toHaveBeenCalledWith('--flag', 'flag', { default: false });
    });
    it('should register command with absolutely no metadata', async () => {
        class NoMetadataCommand extends BaseCommand {
            // No static args at all
            async run() { }
        }
        // Force args to be undefined if it was inherited or defaulted
        (NoMetadataCommand as any).args = undefined;

        mockLoad.mockResolvedValue([
            { command: 'nometadata', class: NoMetadataCommand, instance: new NoMetadataCommand() }
        ]);
        (fs.existsSync as any).mockReturnValue(true);

        const cli = new CLI();
        await cli.start();

        // Should register with empty description and no options/args
        expect(mockCac.command).toHaveBeenCalledWith(expect.stringContaining('nometadata'), '');
    });

    it('should map variadic arguments correctly', async () => {
        // Test class with variadic args
        class VariadicCommand extends BaseCommand {
            static args = {
                args: [{ name: 'items...', required: true }]
            };
            async run() { }
        }
        mockLoad.mockResolvedValue([{
            command: 'list',
            class: VariadicCommand,
            path: '/path/to/list.ts'
        }]);

        const cli = new CLI();
        await cli.start();

        // Simulate execution: list a b c
        const action = mockCommand.action.mock.calls[0][0]; // First registered cmd action
        // args: [['a', 'b', 'c'], options] - CAC passes variadic as array
        const options: any = {};
        await action(['a', 'b', 'c'], options);

        // Expect options.items to be ['a', 'b', 'c']
        expect(options.items).toEqual(['a', 'b', 'c']);

        // Case 2: Empty variadic
        const optionsEmpty: any = {};
        await action(optionsEmpty);
        expect(optionsEmpty.items).toBeUndefined();
    });

    it('should expose commands and raw CLI instance', async () => {
        const cli = new CLI();
        // Just verify they return what we expect (even if empty/mocked)
        expect(cli.getRawCLI()).toBeDefined();
        expect(cli.getCommands()).toEqual([]);

        // After start, commands should be populated
        mockLoad.mockResolvedValue([]);
        (fs.existsSync as any).mockReturnValue(false);
        await cli.start();

        expect(cli.getCommands()).toEqual([]);
    });

    it('should register optional variadic command', async () => {
        class OpVarCommand extends BaseCommand {
            static args = {
                args: [{ name: 'files...', required: false }],
                options: [{ name: '--verbose', description: 'Verbose' }] // No default
            };
            async run() { }
        }

        mockLoad.mockResolvedValue([
            { command: 'opvar', class: OpVarCommand, instance: new OpVarCommand() }
        ]);
        (fs.existsSync as any).mockReturnValue(true);

        const cli = new CLI();
        await cli.start();

        expect(mockCac.command).toHaveBeenCalledWith(
            expect.stringContaining('opvar [...files]'),
            expect.anything()
        );
        expect(mockCommand.option).toHaveBeenCalledWith('--verbose', 'Verbose', { default: undefined });
    });
    it('should register and run grouped subcommands', async () => {
        class GroupCommand extends BaseCommand {
            static args = {
                args: [{ name: 'arg1', required: true }],
                options: [{ name: '--force', description: 'Force' }]
            };
            async run() { }
        }

        mockLoad.mockResolvedValue([
            { command: 'group add', class: GroupCommand, instance: new GroupCommand() },
            { command: 'group remove', class: GroupCommand, instance: new GroupCommand() }
        ]);
        (fs.existsSync as any).mockReturnValue(true);

        const cli = new CLI();
        await cli.start();

        // Should register the group root
        expect(mockCac.command).toHaveBeenCalledWith(
            expect.stringContaining('group <subcommand> [...args]'),
            expect.anything()
        );

        // Find the action for the group command
        // Since we registered multiple commands, find the call for 'group ...'
        const groupCall = mockCac.command.mock.calls.find((call: any) => call[0].startsWith('group'));
        expect(groupCall).toBeDefined();

        // The processed command object (mockCommand) was returned by mockCac.command
        // So mockCommand.action was called. We need to know WHICH action call corresponds to this.
        // But our mockCac.command always returns the SAME mockCommand object.
        // So mockCommand.action has been called multiple times (for 'test', 'opvar', etc from other tests if we didn't clear mocks properly, but beforeEach does clear).
        // In THIS test, it's called for 'group ...'.

        const actionFn = mockCommand.action.mock.calls[0][0];

        const runSpy = vi.spyOn(GroupCommand.prototype, 'run');
        vi.spyOn(GroupCommand.prototype, 'init').mockResolvedValue(undefined);

        // Simulate running: group add val1 --force
        // Args passed to action: subcommand, ...args, options
        // subcommand = 'add'
        // args = [['val1']] (variadic)
        // options = { force: true }
        await actionFn('add', ['val1'], { force: true });

        expect(runSpy).toHaveBeenCalledWith(expect.objectContaining({
            arg1: 'val1',
            force: true
        }));
    });

    it('should handle unknown subcommand', async () => {
        mockLoad.mockResolvedValue([
            { command: 'group add', class: MockCommand, instance: new MockCommand() }
        ]);
        (fs.existsSync as any).mockReturnValue(true);

        const cli = new CLI();
        await cli.start();

        const actionFn = mockCommand.action.mock.calls[0][0];

        const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => { throw new Error('EXIT'); }) as any);
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { });

        // Run unknown subcommand
        await expect(actionFn('unknown', [], {})).rejects.toThrow('EXIT');

        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Unknown subcommand'));
        expect(exitSpy).toHaveBeenCalledWith(1);
    });

    it('should map positional args in subcommand', async () => {
        class SubArgsCommand extends BaseCommand {
            static args = {
                args: [{ name: 'p1', required: true }, { name: 'p2', required: false }]
            };
            async run() { }
        }
        mockLoad.mockResolvedValue([
            { command: 'sys config', class: SubArgsCommand, instance: new SubArgsCommand() }
        ]);
        (fs.existsSync as any).mockReturnValue(true);

        const cli = new CLI();
        await cli.start();

        const actionFn = mockCommand.action.mock.calls[0][0];
        const runSpy = vi.spyOn(SubArgsCommand.prototype, 'run');
        vi.spyOn(SubArgsCommand.prototype, 'init').mockResolvedValue(undefined);

        // sys config a b
        await actionFn('config', ['a', 'b'], {});

        expect(runSpy).toHaveBeenCalledWith(expect.objectContaining({
            p1: 'a',
            p2: 'b'
        }));
    });

    it('should map variadic args in subcommand', async () => {
        class SubVarCommand extends BaseCommand {
            static args = {
                args: [{ name: 'files...', required: true }]
            };
            async run() { }
        }
        mockLoad.mockResolvedValue([
            { command: 'sys add', class: SubVarCommand, instance: new SubVarCommand() }
        ]);
        (fs.existsSync as any).mockReturnValue(true);

        const cli = new CLI();
        await cli.start();

        const actionFn = mockCommand.action.mock.calls[0][0];
        const runSpy = vi.spyOn(SubVarCommand.prototype, 'run');
        vi.spyOn(SubVarCommand.prototype, 'init').mockResolvedValue(undefined);

        await actionFn('add', ['f1', 'f2'], {});

        expect(runSpy).toHaveBeenCalledWith(expect.objectContaining({
            files: ['f1', 'f2']
        }));
    });

    it('should handle subcommand without metadata', async () => {
        class NoMetaSubCommand extends BaseCommand {
            async run() { }
        }
        (NoMetaSubCommand as any).args = undefined;

        mockLoad.mockResolvedValue([
            { command: 'sys plain', class: NoMetaSubCommand, instance: new NoMetaSubCommand() }
        ]);
        (fs.existsSync as any).mockReturnValue(true);

        const cli = new CLI();
        await cli.start();

        const actionFn = mockCommand.action.mock.calls[0][0];
        const runSpy = vi.spyOn(NoMetaSubCommand.prototype, 'run');
        vi.spyOn(NoMetaSubCommand.prototype, 'init').mockResolvedValue(undefined);

        await actionFn('plain', {});

        expect(runSpy).toHaveBeenCalled();
    });

    it('should map positional args in subcommand when fewer provided', async () => {
        class SubOptCommand extends BaseCommand {
            static args = {
                args: [{ name: 'r1', required: true }, { name: 'o1', required: false }]
            };
            async run() { }
        }
        mockLoad.mockResolvedValue([
            { command: 'sys opt', class: SubOptCommand, instance: new SubOptCommand() }
        ]);
        (fs.existsSync as any).mockReturnValue(true);

        const cli = new CLI();
        await cli.start();

        const actionFn = mockCommand.action.mock.calls[0][0];
        const runSpy = vi.spyOn(SubOptCommand.prototype, 'run');
        vi.spyOn(SubOptCommand.prototype, 'init').mockResolvedValue(undefined);

        // Provides 1 arg, expects 2 slots
        await actionFn('opt', ['val1'], {});

        expect(runSpy).toHaveBeenCalledWith(expect.objectContaining({
            r1: 'val1'
        }));
        // o1 should be undefined
    });
});
