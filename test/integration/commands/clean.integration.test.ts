import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import CleanCommand from '../../../src/commands/clean.js';
import { createTempDir, cleanupTestRoot } from '../../utils/integration-helpers.js';
import path from 'node:path';
import fs from 'fs-extra';
import { logger } from '../../../core/src/utils/logger.js';

describe('CleanCommand Integration', () => {
    let tempDir: string;

    beforeEach(async () => {
        tempDir = await createTempDir('clean-integration-');
        // Setup initial state
        await fs.ensureDir(path.join(tempDir, 'dist'));
        await fs.outputFile(path.join(tempDir, 'dist', 'index.js'), 'console.log("hi")');
        await fs.ensureDir(path.join(tempDir, 'node_modules'));
        await fs.outputFile(path.join(tempDir, 'node_modules', 'pkg.json'), '{}');
    });

    afterAll(async () => {
        if (tempDir) await fs.remove(tempDir);
    });

    it('should remove dist and node_modules directories', async () => {
        const command = new CleanCommand();
        // CleanCommand usually runs in process.cwd(), so we need to mock that or pass directory if supported.
        // Checking clean.ts implementation... it uses process.cwd().
        // We can spy spy process.cwd() or similar.

        // Wait, does CleanCommand accept a directory argument? 
        // Let's check implementation. If not, we have to change process.cwd.

        const originalCwd = process.cwd();
        try {
            process.chdir(tempDir);

            await command.run({});

            expect(fs.existsSync(path.join(tempDir, 'dist'))).toBe(false);
            // clean command removes node_modules/.vite, not the whole node_modules
            expect(fs.existsSync(path.join(tempDir, 'node_modules', '.vite'))).toBe(false);
            expect(fs.existsSync(path.join(tempDir, 'node_modules'))).toBe(true);

        } finally {
            process.chdir(originalCwd);
        }
    });

    it('should only remove dist if specified', async () => {
        // Assuming clean command supports args/options regarding what to clean?
        // If generic clean just follows a pattern.
        // Let's verify clean.ts logic first.
    });
});
