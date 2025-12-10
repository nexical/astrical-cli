import { BaseCommand } from '../core/BaseCommand.js';
import { CommandDefinition } from '../core/CommandInterface.js';
import { runCommand } from '../utils/git.js';
import fs from 'node:fs';
import path from 'node:path';

export default class InitCommand extends BaseCommand {
    static description = 'Initialize a new Astrical project';
    static args: CommandDefinition = {
        args: [
            { name: 'directory', required: true, description: 'Directory to initialize the project in' }
        ],
        options: [
            {
                name: '--repo <url>',
                description: 'Starter repository URL (supports gh@owner/repo syntax)',
                default: 'https://github.com/nexical/astrical-starter'
            }
        ]
    };

    static requiresProject = false;

    async run(options: any) {
        const directory = options.directory;
        const targetPath = path.resolve(process.cwd(), directory);
        let repoUrl = options.repo;

        // Handle gh@ syntax
        if (repoUrl.startsWith('gh@')) {
            repoUrl = `https://github.com/${repoUrl.substring(3)}.git`;
        }

        this.info(`Initializing project in: ${targetPath}`);
        this.info(`Using starter repository: ${repoUrl}`);

        if (fs.existsSync(targetPath)) {
            if (fs.readdirSync(targetPath).length > 0) {
                this.error(`Directory ${directory} is not empty.`);
                process.exit(1);
            }
        } else {
            fs.mkdirSync(targetPath, { recursive: true });
        }

        try {
            this.info('Cloning starter repository...');
            await runCommand(`git clone --recursive ${repoUrl} .`, targetPath);

            this.info('Updating submodules...');
            await runCommand('git submodule foreach --recursive "git checkout main && git pull origin main"', targetPath);

            this.info('Installing dependencies...');
            await runCommand('npm install', targetPath);

            this.info('Re-initializing git history...');
            // Orphan branch strategy to wipe history but keep files
            await runCommand('git checkout --orphan new-main', targetPath);
            await runCommand('git add -A', targetPath);
            await runCommand('git commit -m "Initial commit"', targetPath);

            // Delete old main/master (try both common names, catch error if one fails)
            try { await runCommand('git branch -D main', targetPath); } catch { }
            try { await runCommand('git branch -D master', targetPath); } catch { }

            await runCommand('git branch -m main', targetPath);
            await runCommand('git remote remove origin', targetPath);

            this.success(`Project initialized successfully in ${directory}!`);
            this.info(`\nTo get started:\n  cd ${directory}\n  npm run dev`);

        } catch (error: any) {
            this.error(`Failed to initialize project: ${error.message}`);
            process.exit(1);
        }
    }
}
