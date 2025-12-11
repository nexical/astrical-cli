import { describe, it, expect, beforeEach, afterEach, afterAll, vi } from 'vitest';
import BuildCommand from '../../../src/commands/build.js';
import { createTempDir, cleanupTestRoot } from '../../utils/integration-helpers.js';
import path from 'node:path';
import fs from 'fs-extra';
import { spawn } from 'child_process';
import EventEmitter from 'events';

// Mock child_process.spawn
vi.mock('child_process', () => ({
    spawn: vi.fn(),
}));

describe('BuildCommand Integration', () => {
    let projectDir: string;
    let spawnMock: any;

    beforeEach(async () => {
        projectDir = await createTempDir('build-project-');
        vi.mocked(spawn).mockClear();

        // Setup mock project structure
        await fs.ensureDir(path.join(projectDir, 'src', 'core'));
        await fs.outputFile(path.join(projectDir, 'src', 'core', 'index.astro'), '--- ---');

        await fs.ensureDir(path.join(projectDir, 'src', 'content'));
        await fs.outputFile(path.join(projectDir, 'src', 'content', 'config.ts'), 'export const collections = {};');

        await fs.ensureDir(path.join(projectDir, 'public'));
        await fs.outputFile(path.join(projectDir, 'public', 'favicon.ico'), 'icon');

        spawnMock = vi.mocked(spawn).mockImplementation(() => {
            const child: any = new EventEmitter();
            child.stdout = new EventEmitter();
            child.stderr = new EventEmitter();
            setTimeout(() => child.emit('close', 0), 10);
            return child;
        });
    });

    afterEach(() => {
        vi.clearAllMocks();
        vi.restoreAllMocks();
    });

    afterAll(async () => {
        if (projectDir) await fs.remove(projectDir);
    });

    it('should assemble environment and spawn astro build', async () => {
        const command = new BuildCommand();
        // Manually inject project root since we are bypassing CLI discovery
        // BuildCommand doesn't expose setProjectRoot, but BaseCommand typically has protected projectRoot.
        // We can cast to any or use a helper if available. 
        // BaseCommand usually discovers root.

        // Mocking BaseCommand's projectRoot discovery is tricky without init(),
        // but we can just stub findProjectRoot or set the property if public/protected.
        // 'projectRoot' is protected in BaseCommand.
        Object.assign(command, { projectRoot: projectDir });

        await command.run();

        // 1. Verify _site assembly
        const siteDir = path.join(projectDir, '_site');
        expect(fs.existsSync(siteDir)).toBe(true);
        // BuildCommand copies core contents to root of _site
        expect(fs.existsSync(path.join(siteDir, 'index.astro'))).toBe(true);
        expect(fs.existsSync(path.join(siteDir, 'content', 'config.ts'))).toBe(true);
        expect(fs.existsSync(path.join(siteDir, 'public', 'favicon.ico'))).toBe(true);

        // 2. Verify spawn
        expect(spawnMock).toHaveBeenCalledWith(
            'npx',
            ['astro', 'build'],
            expect.objectContaining({
                cwd: expect.stringContaining('_site')
            })
        );
    });
});
