
import fs from 'fs-extra';
import path from 'path';
import { logger } from './logger';

export async function prepareEnvironment(projectRoot: string) {
    const siteDir = path.resolve(projectRoot, '_site');
    const srcDir = path.resolve(projectRoot, 'src');
    const coreDir = path.resolve(srcDir, 'core');
    const modulesDir = path.resolve(srcDir, 'modules');
    const contentDir = path.resolve(srcDir, 'content');
    const publicDir = path.resolve(projectRoot, 'public');

    // 1. Ensure _site exists
    await fs.ensureDir(siteDir);

    // 2. Symlink Core contents
    if (await fs.pathExists(coreDir)) {
        const coreFiles = await fs.readdir(coreDir);
        for (const file of coreFiles) {
            if (file === 'node_modules') continue;

            const srcPath = path.join(coreDir, file);
            const destPath = path.join(siteDir, file);

            // Overwrite existing
            await fs.remove(destPath);
            await fs.ensureSymlink(srcPath, destPath, 'junction');
        }
    } else {
        throw new Error(`Core directory not found at ${coreDir}`);
    }

    // 3. Symlink Modules
    const siteModulesDir = path.join(siteDir, 'src/modules');
    if (await fs.pathExists(modulesDir)) {
        await fs.ensureDir(path.join(siteDir, 'src'));
        await fs.remove(siteModulesDir);
        await fs.ensureSymlink(modulesDir, siteModulesDir, 'junction');
    }

    // 4. Symlink Content
    const siteContentDir = path.join(siteDir, 'content');
    if (await fs.pathExists(contentDir)) {
        await fs.remove(siteContentDir);
        await fs.ensureSymlink(contentDir, siteContentDir, 'junction');
    }

    // 5. Symlink Public
    const sitePublicDir = path.join(siteDir, 'public');
    if (await fs.pathExists(publicDir)) {
        await fs.remove(sitePublicDir);
        await fs.ensureSymlink(publicDir, sitePublicDir, 'junction');
    }
}
