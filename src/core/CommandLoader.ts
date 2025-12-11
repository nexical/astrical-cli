import fs from 'node:fs';
import path from 'node:path';
import { BaseCommand } from './BaseCommand.js';

export interface LoadedCommand {
    command: string; // "module add"
    path: string; // absoltue path to file
    instance: BaseCommand;
    class: any;
}

export class CommandLoader {
    private commands: LoadedCommand[] = [];
    private importer: (path: string) => Promise<any>;

    constructor(importer: (path: string) => Promise<any> = (p) => import(p)) {
        this.importer = importer;
    }

    async load(commandsDir: string): Promise<LoadedCommand[]> {
        if (!fs.existsSync(commandsDir)) {
            return [];
        }

        await this.scan(commandsDir, []);
        return this.commands;
    }

    private async scan(dir: string, prefix: string[]) {
        const files = fs.readdirSync(dir);

        for (const file of files) {
            const fullPath = path.join(dir, file);
            const stat = fs.statSync(fullPath);

            if (stat.isDirectory()) {
                await this.scan(fullPath, [...prefix, file]);
            } else if ((file.endsWith('.ts') || file.endsWith('.js')) && !file.endsWith('.d.ts')) {
                // Ignore index files or non-command files if needed, but for now scan all.
                // Assuming "index.ts" might be the command for the directory path itself if we supported that,
                // but let's stick to "create.ts" -> "create"

                const name = path.basename(file, path.extname(file));
                const commandParts = [...prefix];
                if (name !== 'index') {
                    commandParts.push(name);
                } else if (commandParts.length === 0) {
                    continue; // skip src/commands/index.ts if it exists and doesn't map to anything specific
                }

                // Import
                try {
                    const module = await this.importer(fullPath);
                    // Assume default export is the command class
                    const CommandClass = module.default;

                    if (CommandClass) { // Loose check for now to debug
                        const commandName = commandParts.join(' ');
                        this.commands.push({
                            command: commandName,
                            path: fullPath,
                            instance: new CommandClass(),
                            class: CommandClass
                        });
                    }
                } catch (e) {
                    console.error(`Failed to load command at ${fullPath}`, e);
                }
            }
        }
    }
}
