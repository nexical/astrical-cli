
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import CleanCommand from '../../../src/commands/clean.js';
import { logger } from '../../../src/utils/logger.js';
import fs from 'fs-extra';
import path from 'path';

vi.mock('../../../src/utils/logger.js');
vi.mock('fs-extra');

describe('CleanCommand', () => {
    let command: CleanCommand;

    beforeEach(() => {
        vi.clearAllMocks();
        command = new CleanCommand({});
        vi.mocked(fs.pathExists).mockResolvedValue(false);
        vi.mocked(fs.remove).mockResolvedValue(undefined);
    });

    afterEach(() => {
        vi.resetAllMocks();
    });

    it('should have correct metadata', () => {
        expect(CleanCommand.usage).toBeDefined();
    });

    it('should remove targets if they exist', async () => {
        // Mock targets existing
        vi.mocked(fs.pathExists).mockImplementation(async (p: string) => {
            return p.includes('_site') || p.includes('dist');
        });

        await command.run();

        expect(fs.remove).toHaveBeenCalledWith(expect.stringContaining('_site'));
        expect(fs.remove).toHaveBeenCalledWith(expect.stringContaining('dist'));
        // node_modules/.vite shouldn't be removed if not returning true for pathExists
        // But our mock logic returns true for _site and dist only? 
        // Let's refine mock to be cleaner
    });

    it('should log success', async () => {
        await command.run();
        expect(logger.success).toHaveBeenCalledWith(expect.stringContaining('cleaned'));
    });
});
