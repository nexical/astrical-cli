
import { BaseCommand } from '../../core/src/BaseCommand.js';
import fs from 'fs-extra';
import path from 'path';
import { runCommand } from '../../core/src/utils/shell.js';
import { logger } from '../../core/src/utils/logger.js';

export default class ModuleUpdateCommand extends BaseCommand {
    static paths = [['module', 'update']];
    static usage = 'module update [name]';
    static description = 'Update a specific module or all modules.';
    static requiresProject = true;

    static args = {
        args: [
            { name: 'name', required: false, description: 'Name of the module to update' }
        ]
    };

    async run(name?: string) {
        if (!this.projectRoot) {
            this.error('Project root not found.');
            return;
        }

        this.info(name ? `Updating module ${name}...` : 'Updating all modules...');
        logger.debug('Update context:', { name, projectRoot: this.projectRoot });

        try {
            if (name) {
                const relativePath = `src/modules/${name}`;
                const fullPath = path.resolve(this.projectRoot, relativePath);

                if (!(await fs.pathExists(fullPath))) {
                    this.error(`Module ${name} not found.`);
                    return;
                }

                // Update specific module
                // We enter the directory and pull? Or generic submodule update?
                // Generic submodule update --remote src/modules/name
                await runCommand(`git submodule update --remote --merge ${relativePath}`, this.projectRoot);
            } else {
                // Update all
                await runCommand('git submodule update --remote --merge', this.projectRoot);
            }

            this.info('Syncing workspace dependencies...');
            await runCommand('npm install', this.projectRoot);

            this.success('Modules updated successfully.');
        } catch (e: any) {
            this.error(`Failed to update modules: ${e.message}`);
        }
    }
}
