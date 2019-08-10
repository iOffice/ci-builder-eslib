import * as sinon from 'sinon';
import * as colors from 'colors';
import { checkLogs, Builder, makeBuilder } from './Helper';
import { util, StepResult } from '../../main';
import { Left, Right } from '../../main/fp';

import { default as mockedEnv } from 'mocked-env';
import { assert, expect } from 'chai';

describe('CIBuilder - PreRelease', () => {
  let restoreEnv: () => void = () => {};
  let execCmdStub: sinon.SinonStub;
  let execStub: sinon.SinonStub;
  const warning = colors.yellow('WARNING: ');

  beforeEach(() => {
    execCmdStub = sinon
      .stub(util, 'execCmd')
      .callsFake(async () => Left('cmd error'));
    execStub = sinon
      .stub(util, 'exec')
      .callsFake(async () => Left('cmd error'));
  });

  afterEach(() => {
    restoreEnv();
    execCmdStub.restore();
    execStub.restore();
  });

  it('stops if uncommitted', async () => {
    class TestBuilder extends Builder {}

    restoreEnv = mockedEnv({ PRE_RELEASE: 'true' }, { clear: true });

    const builder = makeBuilder(TestBuilder);
    builder.gitStub.callsFake(async () => Right(['M file1', 'N file 2']));

    const result = await builder.run();
    const errMsg = 'Commit the following files:\n  M file1\n  N file 2';
    result.fold(
      err => expect(err.message).to.equal(errMsg),
      () => assert(false, 'should have failed'),
    );
    checkLogs(builder.logSpy, []);
  });

  it('fails - unable to get branch name', async () => {
    class TestBuilder extends Builder {}

    restoreEnv = mockedEnv({ PRE_RELEASE: 'true' }, { clear: true });

    const builder = makeBuilder(TestBuilder);
    const result = await builder.run();

    result.fold(
      err => expect(err.message).to.equal('Git.getBranch failure: cmd error'),
      () => assert(false, 'should have failed'),
    );
    checkLogs(builder.logSpy, []);
  });

  it('fails - unable to switch branch', async () => {
    class TestBuilder extends Builder {}

    restoreEnv = mockedEnv({ PRE_RELEASE: 'true' }, { clear: true });
    execStub
      .withArgs(`git rev-parse --abbrev-ref HEAD`)
      .returns(Promise.resolve(Right('someBranch')));

    const builder = makeBuilder(TestBuilder);
    const result = await builder.run();
    const errMsg = 'Git.switchBranch(__build, true) failure: cmd error';

    result.fold(
      err => expect(err.message).to.equal(errMsg),
      () => assert(false, 'should have failed'),
    );
    checkLogs(builder.logSpy, [['Git branch: someBranch']]);
  });

  it('fails - beforePublish', async () => {
    class TestBuilder extends Builder {
      async beforePublish(): Promise<StepResult> {
        super.beforePublish();
        return this.io.failure('stop before publish');
      }
    }
    restoreEnv = mockedEnv({ PRE_RELEASE: 'true' }, { clear: true });
    execStub
      .withArgs(`git rev-parse --abbrev-ref HEAD`)
      .returns(Promise.resolve(Right('someBranch')))
      .withArgs('git checkout -b __build -q')
      .returns(Promise.resolve(Right('')));

    const builder = makeBuilder(TestBuilder);
    const result = await builder.run();
    result.fold(
      err => expect(err.message).to.equal('stop before publish'),
      () => assert(false, 'should have failed'),
    );

    checkLogs(builder.logSpy, [
      ['Git branch: someBranch'],
      ["Switched to '__build' branch"],
      ['beforePublish'],
      ['\u001b[31mERROR: \u001b[39mstop before publish'],
      [`${warning}Git.discardBranchChanges failure: cmd error`],
    ]);
  });

  it('fails - publish', async () => {
    class TestBuilder extends Builder {
      async publish(): Promise<StepResult> {
        super.publish();
        return this.io.failure('stop on publish');
      }
    }
    restoreEnv = mockedEnv({ PRE_RELEASE: 'true' }, { clear: true });
    execStub
      .withArgs(`git rev-parse --abbrev-ref HEAD`)
      .returns(Promise.resolve(Right('someBranch')))
      .withArgs('git checkout -b __build -q')
      .returns(Promise.resolve(Right('')));

    const builder = makeBuilder(TestBuilder);
    const result = await builder.run();
    result.fold(
      err => expect(err.message).to.equal('stop on publish'),
      () => assert(false, 'should have failed'),
    );

    checkLogs(builder.logSpy, [
      ['Git branch: someBranch'],
      ["Switched to '__build' branch"],
      ['beforePublish'],
      ['publish'],
      ['\u001b[31mERROR: \u001b[39mstop on publish'],
      [`${warning}Git.discardBranchChanges failure: cmd error`],
    ]);
  });

  it('success', async () => {
    class TestBuilder extends Builder {}
    restoreEnv = mockedEnv({ PRE_RELEASE: 'true' }, { clear: true });
    execStub
      .withArgs(`git rev-parse --abbrev-ref HEAD`)
      .returns(Promise.resolve(Right('someBranch')))
      .withArgs('git checkout -b __build -q')
      .returns(Promise.resolve(Right('')))
      .withArgs('git reset --hard && git clean -fd')
      .returns(Promise.resolve(Right('')))
      .withArgs('git checkout someBranch -q')
      .returns(Promise.resolve(Right('')))
      .withArgs('git branch -D __build -q')
      .returns(Promise.resolve(Right('')));

    const builder = makeBuilder(TestBuilder);
    await builder.run();
    checkLogs(builder.logSpy, [
      ['Git branch: someBranch'],
      ["Switched to '__build' branch"],
      ['beforePublish'],
      ['publish'],
      ['Pre-release successful'],
      ['Branch changes have been discarded'],
      ["Switched to 'someBranch' branch"],
      ["'__build' branch has been deleted"],
    ]);
  });
});
