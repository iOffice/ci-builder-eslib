import * as sinon from 'sinon';
import { assert } from 'chai';
import {
  CIBuilder,
  IBuilder,
  IReleaseInfo,
  StepResult,
} from '../../main/builders';
import {
  BuildUtil,
  Environment,
  Git,
  Github,
  IBuilderMessages,
  IO,
  Yarn,
} from '../../main/services';
import { Exception } from '../../main';
import { Either, Right } from '../../main/fp';

function checkLogs(log: sinon.SinonSpy, calls: string[][]): void {
  assert.deepStrictEqual(log.args, calls);
}

class FakeEnv extends Environment {
  constructor() {
    super();
  }

  readPackage(): Either<Exception, unknown> {
    return Right({
      name: '@scope/ci-builder',
      version: '0.0.0',
      repository: {
        url: 'git+https://github.com/iOffice/ci-builder-eslib.git',
      },
    });
  }
}

class FakeIO extends IO {
  openBlock(): void {}
  closeBlock(): void {}
  loadLogFile(): Either<Exception, IBuilderMessages> {
    return Right({ errors: [], warnings: [] });
  }
  setLogFileReleaseFlag(): Either<Exception, 0> {
    return Right(0);
  }
  dumpMessages(): Either<Exception, 0> {
    return Right(0);
  }
}

function makeBuilder(b: IBuilder): Builder {
  const env = new FakeEnv();
  const io = new FakeIO(env);
  const git = new Git(io);
  const github = new Github(env, io);
  const yarn = new Yarn(env, io);
  const buildUtil = new BuildUtil(env, io, git, github, yarn);
  return new b(env, io, git, github, yarn, buildUtil) as Builder;
}

class Builder extends CIBuilder {
  logSpy = sinon.spy();
  logStub = sinon.stub(this.io, 'log').callsFake((...args: unknown[]) => {
    this.logSpy(...args);
    return Right(0);
  });
  requestStub = sinon.stub(this.github, 'request').callsFake(() => {
    throw 'github error';
  });
  gitStub = sinon
    .stub(this.git, 'getModifiedFiles')
    .callsFake(async () => Right([]));

  isRelease(branch: string, commitMsg: string): boolean {
    return (
      branch === 'master' &&
      !!commitMsg.match(/^Merge pull request #(\d+) from (.*)\/release(.*)/)
    );
  }

  isReleasePullRequest(pullRequestBranch: string): boolean {
    return pullRequestBranch === 'release';
  }

  afterPublish(): Promise<StepResult> {
    return this.io.success(0, 'afterPublish');
  }

  afterVerifyPullRequest(): Promise<StepResult> {
    return this.io.success(0, 'afterVerifyPullRequest');
  }

  beforePublish(): Promise<StepResult> {
    return this.io.success(0, 'beforePublish');
  }

  beforeVerifyPullRequest(): Promise<StepResult> {
    return this.io.success(0, 'beforeVerifyPullRequest');
  }

  publish(): Promise<StepResult> {
    return this.io.success(0, 'publish');
  }

  releaseSetup(param: IReleaseInfo): Promise<StepResult> {
    const { currentVersion: current, newVersion } = param;
    return this.io.success(0, `releaseSetup: ${current} -> ${newVersion}`);
  }

  test(): Promise<StepResult> {
    return this.io.success(0, 'test');
  }

  verifyNonRelease(): Promise<StepResult> {
    return this.io.success(0, 'verifyNonRelease');
  }

  verifyRelease(): Promise<StepResult> {
    return this.io.success(0, 'verifyRelease');
  }
}

export { checkLogs, Builder, makeBuilder };
