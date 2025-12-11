
import { BaseCommand } from '../../core/BaseCommand';
import fs from 'fs-extra';
import path from 'path';
import { runCommand } from '../../utils/shell.js';

export default class ModuleAddCommand extends BaseCommand {
    static paths = [['module', 'add']];
    static usage = 'module add <url> [name]';
    static description = 'Add a module as a git submodule.';
    static requiresProject = true;

    static args = {
        args: [
            { name: 'url', required: true, description: 'Git repository URL' },
            { name: 'name', required: false, description: 'Folder name for the module' }
        ]
    };

    async run(options: any) {
        console.log('DEBUG: ModuleAdd Options:', JSON.stringify(options, null, 2));
        let { url, name } = options;

        if (!this.projectRoot) {
            this.error('Project root not found.');
            return;
        }

        if (!url) {
            this.error('Please specify a repository URL.');
            return;
        }

        // Expand gh@ syntax
        if (url.startsWith('gh@')) {
            url = url.replace('gh@', 'https://github.com/');
            if (!url.endsWith('.git')) url += '.git';
        }

        if (!name) {
            // Extract name from URL
            const basename = path.basename(url, '.git');
            name = basename;
        }

        const modulesDir = path.resolve(this.projectRoot, 'src', 'modules');
        const targetDir = path.join(modulesDir, name);
        const relativeTargetDir = path.relative(this.projectRoot, targetDir);

        if (await fs.pathExists(targetDir)) {
            this.error(`Module ${name} already exists at ${relativeTargetDir}.`);
            return;
        }

        this.info(`Adding submodule ${name} from ${url}...`);

        console.log('DEBUG: projectRoot', this.projectRoot);
        console.log('DEBUG: targetDir', targetDir);
        console.log('DEBUG: relativeTargetDir', relativeTargetDir);
        console.log('DEBUG: Executing git submodule add', url, relativeTargetDir);

        try {
            await runCommand(`git submodule add ${url} ${relativeTargetDir}`, this.projectRoot);

            this.info('Syncing workspace dependencies...');
            await runCommand('npm install', this.projectRoot);

            this.success(`Module ${name} added successfully.`);
        } catch (e: any) {
            this.error(`Failed to add module: ${e.message}`);
        }
    }
}
