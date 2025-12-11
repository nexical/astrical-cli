import { describe, it, expect, beforeEach, afterEach, afterAll, vi } from 'vitest';
import RunCommand from '../../../src/commands/run.js';
import { createTempDir } from '../../utils/integration-helpers.js';
import path from 'node:path';
import fs from 'fs-extra';
import { spawn } from 'child_process';
import EventEmitter from 'events';

vi.mock('child_process', () => ({
    spawn: vi.fn(),
}));

describe('RunCommand Integration', () => {
    let projectDir: string;
    let spawnMock: any;

    beforeEach(async () => {
        projectDir = await createTempDir('run-project-');
        vi.mocked(spawn).mockClear();

        // Setup minimal env
        await fs.ensureDir(path.join(projectDir, 'src', 'core'));

        // Setup a module with a script
        await fs.ensureDir(path.join(projectDir, 'src', 'modules', 'my-auth'));
        await fs.outputFile(path.join(projectDir, 'src', 'modules', 'my-auth', 'package.json'), JSON.stringify({
            scripts: {
                'seed': 'node seed.js'
            }
        }));

        spawnMock = vi.mocked(spawn).mockImplementation(() => {
            const child: any = new EventEmitter();
            child.stdout = new EventEmitter();
            child.stderr = new EventEmitter();
            setTimeout(() => child.emit('close', 0), 10);
            child.kill = vi.fn();
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

    it('should run standard npm scripts', async () => {
        const command = new RunCommand();
        Object.assign(command, { projectRoot: projectDir });

        await command.run('test-script', '--flag', {}); // Add options object

        expect(spawnMock).toHaveBeenCalledWith(
            'npm',
            ['run', 'test-script', '--', '--flag'],
            expect.objectContaining({
                cwd: expect.stringContaining('_site')
            })
        );
    });

    it('should run module specific scripts', async () => {
        const command = new RunCommand();
        Object.assign(command, { projectRoot: projectDir });

        await command.run('my-auth:seed', '--force', {}); // Add options object

        // Module scripts run using sh -c or cmd /c
        const expectedCmd = process.platform === 'win32' ? 'cmd' : 'sh';
        const expectedArgs = process.platform === 'win32'
            ? ['/c', 'node seed.js --force']
            : ['-c', 'node seed.js --force'];

        expect(spawnMock).toHaveBeenCalledWith(
            expectedCmd,
            expectedArgs,
            expect.anything()
        );
    });
});
