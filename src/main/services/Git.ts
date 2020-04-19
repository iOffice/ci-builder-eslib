import { IO } from './IO';
import { Either, asyncEvalIteration } from '@ioffice/fp';
import { Exception, util } from '../util';

class Git {
  constructor(private io: IO) {}

  /**
   * Obtain the current git branch.
   */
  async getBranch(): Promise<Either<Exception, string>> {
    return (await util.exec(`git rev-parse --abbrev-ref HEAD`)).fold(
      err => this.io.failure(`Git.getBranch failure: ${err}`),
      branch => this.io.success(branch, `Git branch: ${branch}`),
    );
  }

  /**
   * Obtain the very first commit for the repo.
   */
  async getFirstCommit(): Promise<Either<Exception, string>> {
    return (await util.exec('git rev-list --max-parents=0 HEAD')).fold(
      err => this.io.failure(`Git.getFirstCommit failure: ${err}`),
      commit => this.io.success(commit, `First commit: ${commit}`),
    );
  }

  /**
   * Obtain the latest commit in the current branch.
   */
  async getCurrentCommit(): Promise<Either<Exception, string>> {
    return (await util.exec('git rev-parse HEAD')).fold(
      err => this.io.failure(`Git.getCurrentCommit failure: ${err}`),
      commit => this.io.success(commit, `Current commit: ${commit}`),
    );
  }

  /**
   * Returns a list of all the files that have not yet been committed.
   */
  async getModifiedFiles(): Promise<Either<Exception, string[]>> {
    return (await util.execCmd('git status -s')).fold(
      err => this.io.failure(`Git.getModifiedFiles failure: ${err}`),
      value =>
        this.io.success(
          value
            .split('\n')
            .map(x => x.trim())
            .filter(x => x),
        ),
    );
  }

  /**
   * Switch the git branch.
   */
  async switchBranch(
    branch: string,
    isNew = false,
  ): Promise<Either<Exception, string>> {
    const newFlag = isNew ? ' -b' : '';
    return (await util.exec(`git checkout${newFlag} ${branch} -q`)).fold(
      err =>
        this.io.failure(
          `Git.switchBranch(${branch}, ${isNew}) failure: ${err}`,
        ),
      output => this.io.success(output, `Switched to '${branch}' branch`),
    );
  }

  /**
   * Remove all the changes in the current branch.
   */
  async discardBranchChanges(): Promise<Either<Exception, string>> {
    return (await util.exec('git reset --hard && git clean -fd')).fold(
      err => this.io.failure(`Git.discardBranchChanges failure: ${err}`),
      output => this.io.success(output, `Branch changes have been discarded`),
    );
  }

  /**
   * Delete a git branch.
   */
  async deleteBranch(branch: string): Promise<Either<Exception, string>> {
    return (await util.exec(`git branch -D ${branch} -q`)).fold(
      err => this.io.failure(`Git.deleteBranch('${branch}') failure: ${err}`),
      output => this.io.success(output, `'${branch}' branch has been deleted`),
    );
  }

  /**
   * Provides a safe way of first discarding all the current changes in the branch we wish to
   * delete. We first discard all the changes, then we move to the branch we want to be on and
   * finally we delete the branch that we no longer want.
   */
  async switchAndDelete(
    toBranch: string,
    fromBranch: string,
  ): Promise<Either<Exception, boolean>> {
    return asyncEvalIteration(async () => {
      for (const _ of await this.discardBranchChanges())
        for (const _ of await this.switchBranch(toBranch))
          for (const _ of await this.deleteBranch(fromBranch)) return true;
    });
  }
}

export { Git };
