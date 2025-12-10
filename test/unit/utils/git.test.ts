import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as git from '../../../src/utils/git.js';
import * as shell from '../../../src/utils/shell.js';

vi.mock('../../../src/utils/shell.js');

describe('git utils', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.resetAllMocks();
    });

    it('should clone repository', async () => {
        await git.clone('http://repo.git', 'dest', true);
        expect(shell.runCommand).toHaveBeenCalledWith(
            'git clone --recursive http://repo.git .',
            'dest'
        );

        await git.clone('http://repo.git', 'dest', false);
        expect(shell.runCommand).toHaveBeenCalledWith(
            'git clone http://repo.git .',
            'dest'
        );
    });

    it('should update submodules', async () => {
        await git.updateSubmodules('cwd');
        expect(shell.runCommand).toHaveBeenCalledWith(
            expect.stringContaining('git submodule foreach'),
            'cwd'
        );
    });

    it('should checkout orphan branch', async () => {
        await git.checkoutOrphan('branch', 'cwd');
        expect(shell.runCommand).toHaveBeenCalledWith('git checkout --orphan branch', 'cwd');
    });

    it('should add all files', async () => {
        await git.addAll('cwd');
        expect(shell.runCommand).toHaveBeenCalledWith('git add -A', 'cwd');
    });

    it('should commit', async () => {
        await git.commit('msg', 'cwd');
        expect(shell.runCommand).toHaveBeenCalledWith('git commit -m "msg"', 'cwd');
    });

    it('should delete branch', async () => {
        await git.deleteBranch('branch', 'cwd');
        expect(shell.runCommand).toHaveBeenCalledWith('git branch -D branch', 'cwd');
    });

    it('should rename branch', async () => {
        await git.renameBranch('branch', 'cwd');
        expect(shell.runCommand).toHaveBeenCalledWith('git branch -m branch', 'cwd');
    });

    it('should remove remote', async () => {
        await git.removeRemote('origin', 'cwd');
        expect(shell.runCommand).toHaveBeenCalledWith('git remote remove origin', 'cwd');
    });
});
