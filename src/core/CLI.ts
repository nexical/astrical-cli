import { cac } from 'cac';
import { CommandLoader } from './CommandLoader.js';
import { BaseCommand } from './BaseCommand.js';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import pc from 'picocolors';
import pkg from '../../package.json';
import { logger, setDebugMode } from '../utils/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export class CLI {
    private cli = cac('astrical');
    private loader = new CommandLoader();
    private HelpCommandClass: any;

    constructor() {
        // No default constructor action
    }

    private loadedCommands: any[] = [];

    getCommands() {
        return this.loadedCommands;
    }

    getRawCLI() {
        return this.cli;
    }

    async start() {
        // In built version, we are in dist/index.js or similar
        // Commands should be in dist/commands if we build them there
        // If we are running in dev (ts-node), we are in src/index.ts

        // Strategy: Try both relative locations (sibling 'commands' folder)
        // because tsup might put index.js at root of dist, and commands in dist/commands

        // Check for debug flag early
        if (process.argv.includes('--debug')) {
            setDebugMode(true);
            logger.debug('Debug mode enabled via --debug flag');
        }

        const possibleDirs = [
            path.resolve(__dirname, 'commands'),
            path.resolve(__dirname, '../commands'),
            path.resolve(__dirname, '../src/commands')
        ];

        let commandsDir = '';
        for (const dir of possibleDirs) {
            if (fs.existsSync(dir)) {
                commandsDir = dir;
                break;
            }
        }

        // Fallback or error
        if (!commandsDir) {
            logger.debug("No commands directory found.");
        }

        this.loadedCommands = await this.loader.load(commandsDir);

        // Group commands by root command name
        const commandGroups: Record<string, any[]> = {};
        // Locate HelpCommand for fallback usage
        const helpCmd = this.loadedCommands.find(c => c.command === 'help');
        if (helpCmd) {
            this.HelpCommandClass = helpCmd.class;
        }

        for (const cmd of this.loadedCommands) {
            const root = cmd.command.split(' ')[0];
            if (!commandGroups[root]) commandGroups[root] = [];
            commandGroups[root].push(cmd);
        }

        for (const [root, cmds] of Object.entries(commandGroups)) {
            // Case 1: Single command, no subcommands (e.g. 'init')
            if (cmds.length === 1 && cmds[0].command === root) {
                const cmd = cmds[0];
                const CommandClass = cmd.class;
                // Original logic for single command
                let commandName = cmd.command;
                const argsDef = CommandClass.args || {};
                if (argsDef.args) {
                    argsDef.args.forEach((arg: any) => {
                        const isVariadic = arg.name.endsWith('...');
                        const cleanName = isVariadic ? arg.name.slice(0, -3) : arg.name;
                        if (arg.required) commandName += isVariadic ? ` <...${cleanName}>` : ` <${cleanName}>`;
                        else commandName += isVariadic ? ` [...${cleanName}]` : ` [${cleanName}]`;
                    });
                }
                const cacCommand = this.cli.command(commandName, CommandClass.description || '');

                // Register options
                if (argsDef.options) {
                    argsDef.options.forEach((opt: any) => {
                        cacCommand.option(opt.name, opt.description, { default: opt.default });
                    });
                }
                this.registerGlobalOptions(cacCommand);

                cacCommand.action(async (...args: any[]) => {
                    const options = args.pop();

                    if (options.help) {
                        await this.runHelp([cmd.command]);
                        return;
                    }

                    const positionalArgs = args;
                    if (argsDef.args) {
                        argsDef.args.forEach((arg: any, index: number) => {
                            const isVariadic = arg.name.endsWith('...');
                            const name = isVariadic ? arg.name.slice(0, -3) : arg.name;
                            if (index < positionalArgs.length) options[name] = positionalArgs[index];
                        });
                    }
                    await this.runCommand(CommandClass, options);
                });
            } else {
                // Case 2: Command with subcommands (e.g. 'module add')
                // Register 'module <subcommand>' catch-all
                const commandName = `${root} [subcommand] [...args]`;
                const cacCommand = this.cli.command(commandName, `Manage ${root} commands`);

                cacCommand.allowUnknownOptions(); // Pass options to subcommand
                this.registerGlobalOptions(cacCommand);

                cacCommand.action(async (subcommand: string, ...args: any[]) => {
                    const options = args.pop(); // last is options

                    if (!subcommand || options.help) {
                        // If --help is passed to 'module --help', subcommand might be caught as 'module' if args parsing is weird?  
                        // ACTUALLY: cac parses 'module add --help' as subcommand="add".
                        // 'module --help' might trigger the command itself? No, 'module <subcommand>' expects a subcommand.
                        // If I run 'module --help', it might fail validation or parse 'help' as subcommand if unlucky, 
                        // but likely it just prints help if we didn't override.

                        await this.runHelp([root, subcommand].filter(Boolean));
                        return;
                    }


                    // Find matching command
                    // Match against "root subcommand"
                    const fullCommandName = `${root} ${subcommand}`;
                    const cmd = cmds.find(c => c.command === fullCommandName);

                    if (!cmd) {
                        console.error(pc.red(`Unknown subcommand '${subcommand}' for '${root}'`));
                        process.exit(1);
                    }

                    const CommandClass = cmd.class;
                    // Map remaining args? 
                    // The args array contains positional args AFTER subcommand.
                    // But we didn't define them in CAC, so they are just strings.
                    // We need to map them manually to the Target Command's args definition.
                    // argsDef.args usually starts after the command.
                    // For 'module add <url>', <url> is the first arg after 'add'.
                    // So 'args' here corresponds to <url>.

                    const argsDef = CommandClass.args || {};
                    // If using [...args], the variadic args are collected into the first argument array
                    // args here is what remains after popping options.
                    const positionalArgs = (args.length > 0 && Array.isArray(args[0])) ? args[0] : args;

                    const childOptions = { ...options }; // Copy options

                    if (argsDef.args) {
                        argsDef.args.forEach((arg: any, index: number) => {
                            const isVariadic = arg.name.endsWith('...');
                            const name = isVariadic ? arg.name.slice(0, -3) : arg.name;
                            if (index < positionalArgs.length) {
                                if (isVariadic) {
                                    childOptions[name] = positionalArgs.slice(index);
                                } else {
                                    childOptions[name] = positionalArgs[index];
                                }
                            }
                        });
                    }

                    await this.runCommand(CommandClass, childOptions);
                });
            }
        }
        // Disable default help
        // this.cli.help(); 

        // Manually register global help to ensure it's allowed
        this.cli.option('--help, -h', 'Display help');

        this.cli.version(pkg.version);

        // Global help interception for root command
        // If we run `astrical --help`, we need to catch it.
        // CAC doesn't expose a clean global action without a command content.
        // However, if we parse and no command matches, it usually errors or shows help.
        // If we have default logic, we can put it here?
        // Let's rely on standard parsing but maybe inspect raw args first?

        if (process.argv.includes('--help') || process.argv.includes('-h')) {
            // Inspect non-option args to see if there's a command?
            const args = process.argv.slice(2).filter(a => !a.startsWith('-'));
            if (args.length === 0) {
                await this.runHelp([]);
                process.exit(0);
            }
        }

        try {
            this.cli.parse();
        } catch (e: any) {
            console.error(pc.red(e.message));
            process.exit(1);
        }
    }

    private registerGlobalOptions(cacCommand: any) {
        cacCommand.option('--root-dir <path>', 'Override project root');
        cacCommand.option('--debug', 'Enable debug mode');
        cacCommand.option('--help, -h', 'Display help message');
    }

    private async runHelp(commandParts: string[]) {
        if (this.HelpCommandClass) {
            const helpInstance = new this.HelpCommandClass();
            helpInstance.setCli(this);
            await helpInstance.run({ command: commandParts });
        } else {
            // Fallback if HelpCommand not loaded (shouldn't happen)
            this.cli.outputHelp();
        }
    }

    private async runCommand(CommandClass: any, options: any) {
        try {
            const instance = new CommandClass(options);
            instance.setCli(this);
            await instance.init();
            await instance.run(options);
        } catch (e: any) {
            console.error(pc.red(e.message));
            if (options.debug) console.error(e.stack);
            process.exit(1);
        }
    }
}
