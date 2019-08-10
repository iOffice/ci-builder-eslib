import * as sinon from 'sinon';
import { checkLogs, Builder, makeBuilder } from './Helper';
import { util, StepResult } from '../../main';
import { Left } from '../../main/fp';
import { default as mockedEnv } from 'mocked-env';
import { assert, expect } from 'chai';

describe('AbstractBuilder - Master Branch', () => {
  let restoreEnv: () => void = () => {};
  let execCmdStub: sinon.SinonStub;
  let execStub: sinon.SinonStub;

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

  it('merged non-release branch', async () => {
    class TestBuilder extends Builder {}
    restoreEnv = mockedEnv({
      TEAMCITY: 'true',
      TEAMCITY_TARGET_BRANCH: 'master',
      TEAMCITY_COMMIT_MESSAGE:
        'Merge pull request #12 from iOffice/superBranch did something good',
    });

    const builder = makeBuilder(TestBuilder);
    await builder.run();
    checkLogs(builder.logSpy, [
      ['test'],
      ["New changes on 'master' branch."],
      [
        'Skipping release on \'master\' branch.\nLast commit message: "Merge pull request #12 from iOffice/superBranch did something good"',
      ],
    ]);
  });

  it('merged release - fail beforePublish', async () => {
    class TestBuilder extends Builder {
      async beforePublish(): Promise<StepResult> {
        await super.beforePublish();
        return this.io.failure('stop before publish');
      }
    }
    restoreEnv = mockedEnv({
      TEAMCITY: 'true',
      TEAMCITY_TARGET_BRANCH: 'master',
      TEAMCITY_COMMIT_MESSAGE:
        'Merge pull request #12 from iOffice/release\n0.0.0',
    });

    const builder = makeBuilder(TestBuilder);
    const result = await builder.run();
    result.fold(
      err => expect(err.message).to.equal('stop before publish'),
      () => assert(false, 'should have failed'),
    );

    checkLogs(builder.logSpy, [
      ['test'],
      ["New changes on 'master' branch."],
      ['beforePublish'],
    ]);
  });

  it('merged release - fail publish', async () => {
    class TestBuilder extends Builder {
      async publish(): Promise<StepResult> {
        await super.publish();
        return this.io.failure('stop publish');
      }
    }
    restoreEnv = mockedEnv({
      TEAMCITY: 'true',
      TEAMCITY_TARGET_BRANCH: 'master',
      TEAMCITY_COMMIT_MESSAGE:
        'Merge pull request #12 from iOffice/release 0.0.0',
    });

    const builder = makeBuilder(TestBuilder);
    const result = await builder.run();
    result.fold(
      err => expect(err.message).to.equal('stop publish'),
      () => assert(false, 'should have failed'),
    );
    checkLogs(builder.logSpy, [
      ['test'],
      ["New changes on 'master' branch."],
      ['beforePublish'],
      ['publish'],
    ]);
  });

  it('merged release - fail after publish', async () => {
    class TestBuilder extends Builder {
      async afterPublish(): Promise<StepResult> {
        await super.afterPublish();
        return this.io.failure('afterPublish error');
      }
    }
    restoreEnv = mockedEnv({
      TEAMCITY: 'true',
      TEAMCITY_TARGET_BRANCH: 'master',
      TEAMCITY_COMMIT_MESSAGE:
        'Merge pull request #12 from iOffice/release 0.0.0',
    });

    const builder = makeBuilder(TestBuilder);
    await builder.run();
    checkLogs(builder.logSpy, [
      ['test'],
      ["New changes on 'master' branch."],
      ['beforePublish'],
      ['publish'],
      ['Released version 0.0.0'],
      ['afterPublish'],
      ["##teamcity[message text='afterPublish error' status='WARNING']"],
    ]);
  });

  it('merged release - success', async () => {
    class TestBuilder extends Builder {}
    restoreEnv = mockedEnv({
      TEAMCITY: 'true',
      TEAMCITY_TARGET_BRANCH: 'master',
      TEAMCITY_COMMIT_MESSAGE:
        'Merge pull request #12 from iOffice/release 0.0.0',
    });

    const builder = makeBuilder(TestBuilder);
    await builder.run();
    checkLogs(builder.logSpy, [
      ['test'],
      ["New changes on 'master' branch."],
      ['beforePublish'],
      ['publish'],
      ['Released version 0.0.0'],
      ['afterPublish'],
    ]);
  });
});
