import * as semver from 'semver';
import * as Mocha from 'mocha';
import * as colors from 'colors';

import {
  CIBuilder,
  runBuilder,
  StepResult,
  IReleaseInfo,
  CI,
  Exception,
  util,
} from './main';
import { Left, Right, Maybe, asyncPipeEither, Either } from '@ioffice/fp';

class Builder extends CIBuilder {
  readonly releaseBranchMerged = /^Merge pull request #(\d+) from (.*)\/release(.*)/;

  async isRelease(branch: string, commitMsg: string): Promise<boolean> {
    const isMasterBranch = ['master', 'refs/heads/master'].includes(branch);
    // Only running the release build in node 8
    const isNode8 = (await this.buildUtil.getNodeVersion())
      .map(ver => ver.major === 8)
      .getOrElse(false);

    return (
      isNode8 && isMasterBranch && !!commitMsg.match(this.releaseBranchMerged)
    );
  }

  async isReleasePullRequest(pullRequestBranch: string): Promise<boolean> {
    return pullRequestBranch === 'release';
  }

  test(): Promise<StepResult> {
    return new Promise<StepResult>(fulfill => {
      const mocha = new Mocha();
      if (this.env.ci === CI.TRAVIS) {
        mocha.useColors(true);
      }
      mocha.addFile('build/test/index.js');
      mocha.run(failures => {
        if (failures > 0) {
          const verb = failures === 1 ? 'is' : 'are';
          const amount = failures === 1 ? '' : 's';
          fulfill(
            Left(
              new Exception(`There ${verb} ${failures} test${amount} failing`),
            ),
          );
        } else {
          this.io.log('Testing passed');
          fulfill(Right(0));
        }
      });
    });
  }

  beforeVerifyPullRequest(): Promise<StepResult> {
    return this.io.success(0);
  }

  verifyNonRelease(): Promise<StepResult> {
    return this.buildUtil.verifyUntouchedPackageVersion();
  }

  verifyRelease(): Promise<StepResult> {
    return this.buildUtil.verifyNewPackageVersion();
  }

  afterVerifyPullRequest(): Promise<StepResult> {
    return this.io.success(0);
  }

  async beforePublish(): Promise<StepResult> {
    return util.move('build/main/', '.').map(_ => 0 as 0);
  }

  async getPublishInfo(): Promise<Either<Exception, [string, string]>> {
    const version = this.env.packageVersion;
    if (this.env.isPreRelease) {
      const majorEither = Maybe(semver.parse(version))
        .map(x => x.major)
        .toRight(new Exception(`Unable to parse version: ${version}`));
      return asyncPipeEither(
        () => majorEither,
        () => this.git.getCurrentCommit(),
        ([major, commit]) => Right(`${major}.0.0-SNAPSHOT.${commit}`),
        ([, , ver]) => Right([ver, 'snapshot']),
      );
    }
    return Right([version, 'latest']);
  }

  /**
   * Publish to npm.
   */
  async publish(): Promise<StepResult> {
    const name = this.env.packageName;
    return asyncPipeEither(
      () => this.getPublishInfo(),
      ([[version, tag]]) => this.yarn.publish(version, tag),
      ([[version, tag]]) =>
        this.io.success(
          0,
          [
            '\nRun:',
            colors.green(`  yarn add ${name}@${tag} -E -D`),
            `  to install ${name}@${colors.blue(version)}\n`,
          ].join('\n'),
        ),
    );
  }

  /**
   * Notify github that we have published a new version.
   */
  afterPublish(): Promise<StepResult> {
    return this.github.createRelease();
  }

  releaseSetup(param: IReleaseInfo): Promise<StepResult> {
    const { currentVersion: ver, newVersion: newVer } = param;
    return asyncPipeEither(
      _ => util.changePackageVersion(newVer),
      _ => this.buildUtil.updateChangeLog(newVer),
      _ => this.buildUtil.replaceVersionsInREADME(ver, newVer),
    );
  }
}

async function main(): Promise<void> {
  const { code } = await runBuilder(Builder);

  process.on('exit', () => {
    process.exit(code);
  });
}

main();
