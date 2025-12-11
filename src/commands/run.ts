
import { BaseCommand } from '../core/BaseCommand';
import fs from 'fs-extra';
import path from 'path';
import { spawn } from 'child_process';
import process from 'node:process';
import { prepareEnvironment } from '../utils/environment.js';
import { logger } from '../utils/logger.js';

export default class RunCommand extends BaseCommand {
    static paths = [['run']];
    static usage = 'run <script> [args...]';
    static description = 'Run a script inside the Astrical environment.';
    static requiresProject = true;

    static args = {
        args: [
            { name: 'script', required: true, description: 'The script to run' },
            { name: 'args...', required: false, description: 'Arguments for the script' }
        ]
    };

    async run(script: string, ...args: any[]) {
        if (!this.projectRoot) {
            this.error('Project root not found.');
            return;
        }

        // args will contain variadic args and THEN the options object as the last element.
        const options = args.pop();
        const scriptArgs = args; // The rest are the [args...]

        if (!script) {
            this.error('Please specify a script to run.');
            return;
        }

        await prepareEnvironment(this.projectRoot!);
        const siteDir = path.resolve(this.projectRoot!, '_site');

        logger.debug('Run command context:', { script, args: scriptArgs, siteDir });

        // Initialize command to default npm run
        let finalCmd = 'npm';
        let finalArgs = ['run', script, '--', ...scriptArgs];

        // Check for module:script syntax
        if (script.includes(':')) {
            const [moduleName, scriptName] = script.split(':');
            const modulePath = path.resolve(this.projectRoot!, 'src', 'modules', moduleName);
            logger.debug(`Resolving module script: ${moduleName}:${scriptName} at ${modulePath}`);

            // Check if module exists
            const modulePkgJsonPath = path.join(modulePath, 'package.json');
            if (await fs.pathExists(modulePkgJsonPath)) {
                try {
                    const pkg = await fs.readJson(modulePkgJsonPath);
                    if (pkg.scripts && pkg.scripts[scriptName]) {
                        // Found the module script
                        const rawCommand = pkg.scripts[scriptName];
                        this.info(`Running module script: ${moduleName}:${scriptName}`);

                        // Execute raw command using shell
                        finalCmd = 'sh';
                        finalArgs = ['-c', `${rawCommand} ${scriptArgs.join(' ')}`];

                        if (process.platform === 'win32') {
                            finalCmd = 'cmd';
                            finalArgs = ['/c', `${rawCommand} ${scriptArgs.join(' ')}`];
                        }
                    } else {
                        // Script not found in module, confusing usage?
                    }
                } catch (e: any) {
                    this.error(`Failed to read package.json for module ${moduleName}: ${e.message}`);
                    return;
                }
            }
        }

        logger.debug(`Executing final command: ${finalCmd} ${finalArgs.join(' ')} `);

        const child = spawn(finalCmd, finalArgs, {
            cwd: siteDir,
            stdio: 'inherit',
            env: {
                ...process.env,
                FORCE_COLOR: '1'
            }
        });

        // Handle process termination to kill child
        const cleanup = () => {
            child.kill();
            process.exit();
        };

        process.on('SIGINT', cleanup);
        process.on('SIGTERM', cleanup);

        await new Promise<void>((resolve) => {
            child.on('close', (code) => {
                if (code !== 0) {
                    process.exit(code || 1);
                }
                resolve();
            });
        });
    }
}
