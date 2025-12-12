
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { prepareEnvironment } from '../../../src/utils/environment.js';
import fs from 'fs-extra';
import path from 'path';

vi.mock('fs-extra');
vi.mock('../../../src/utils/logger.js');

describe('prepareEnvironment', () => {
    const mockRoot = '/mock/root';

    beforeEach(() => {
        vi.clearAllMocks();
        // Default happy path mocks
        vi.mocked(fs.pathExists).mockImplementation(async (p: string) => {
            if (p.includes('src/core')) return true;
            if (p.includes('src/modules')) return true;
            if (p.includes('src/content')) return true;
            if (p.includes('public')) return true;
            return false;
        });
        vi.mocked(fs.readdir).mockResolvedValue(['file1.ts', 'node_modules', 'subdir'] as any);
    });

    afterEach(() => {
        vi.resetAllMocks();
    });

    it('should create site dir and symlink all components', async () => {
        await prepareEnvironment(mockRoot);

        // 1. Ensure _site
        expect(fs.ensureDir).toHaveBeenCalledWith(expect.stringContaining('_site'));

        // 2. Core (skipping node_modules)
        expect(fs.readdir).toHaveBeenCalledWith(expect.stringContaining('src/core'));
        expect(fs.ensureSymlink).toHaveBeenCalledWith(
            expect.stringContaining('src/core/file1.ts'),
            expect.stringContaining('_site/file1.ts'),
            'junction'
        );
        expect(fs.ensureSymlink).not.toHaveBeenCalledWith(
            expect.stringContaining('src/core/node_modules'),
            expect.anything(),
            expect.anything()
        );

        // 3. Modules
        expect(fs.ensureDir).toHaveBeenCalledWith(expect.stringContaining('_site/src'));
        expect(fs.ensureSymlink).toHaveBeenCalledWith(
            expect.stringContaining('src/modules'),
            expect.stringContaining('_site/src/modules'),
            'junction'
        );

        // 4. Content
        expect(fs.ensureSymlink).toHaveBeenCalledWith(
            expect.stringContaining('src/content'),
            expect.stringContaining('_site/content'),
            'junction'
        );

        // 5. Public
        expect(fs.ensureSymlink).toHaveBeenCalledWith(
            expect.stringContaining('public'),
            expect.stringContaining('_site/public'),
            'junction'
        );
    });

    it('should throw if core directory is missing', async () => {
        vi.mocked(fs.pathExists).mockResolvedValue(false);
        await expect(prepareEnvironment(mockRoot)).rejects.toThrow('Core directory not found');
    });

    it('should handle missing modules, content, and public directories gracefully', async () => {
        vi.mocked(fs.pathExists).mockImplementation(async (p: string) => {
            if (p.includes('src/core')) return true; // Only Core exists
            return false;
        });

        await prepareEnvironment(mockRoot);

        expect(fs.ensureDir).toHaveBeenCalledWith(expect.stringContaining('_site'));
        // Core check
        expect(fs.readdir).toHaveBeenCalled();

        // Modules check - ensureSymlink NOT called for modules
        expect(fs.ensureSymlink).not.toHaveBeenCalledWith(
            expect.stringContaining('src/modules'),
            expect.anything(),
            expect.anything()
        );
        // Content check - ensureSymlink NOT called for content
        expect(fs.ensureSymlink).not.toHaveBeenCalledWith(
            expect.stringContaining('src/content'),
            expect.anything(),
            expect.anything()
        );
        // Public check - ensureSymlink NOT called for public
        expect(fs.ensureSymlink).not.toHaveBeenCalledWith(
            expect.stringContaining('public'),
            expect.anything(),
            expect.anything()
        );
    });
});
