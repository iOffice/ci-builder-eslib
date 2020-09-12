import * as sinon from 'sinon';
import * as colors from 'colors';
import { checkLogs, Builder, makeBuilder } from './Helper';
import { StepResult, Environment, util } from '../../main';
import { Left } from '@ioffice/fp';
import { default as mockedEnv } from 'mocked-env';
import { assert, expect } from 'chai';
import { getEnv, TC } from '../../main/services/environments';

describe('CIBuilder - Pull Request', () => {
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

  it('fails before verification', async () => {
    class TestBuilder extends Builder {
      async beforeVerifyPullRequest(): Promise<StepResult> {
        await super.beforeVerifyPullRequest();
        return this.io.failure('beforeVerifyPullRequest error');
      }
    }
    restoreEnv = mockedEnv(
      {
        TEAMCITY: 'true',
        TEAMCITY_PULL_REQUEST_BRANCH: 'myBranch',
        TEAMCITY_TARGET_BRANCH: 'master',
      },
      { clear: true },
    );

    const builder = makeBuilder(TestBuilder);
    const result = await builder.run();
    result.fold(
      (err) => expect(err.message).to.equal('beforeVerifyPullRequest error'),
      () => assert(false, 'should have failed'),
    );

    checkLogs(builder.logSpy, [
      ['test'],
      ['Handling pull request'],
      ['beforeVerifyPullRequest'],
    ]);
  });

  it('fails - verifyNonRelease', async () => {
    class TestBuilder extends Builder {
      async verifyNonRelease(): Promise<StepResult> {
        await super.verifyNonRelease();
        return this.io.failure('verifyNonRelease error');
      }
    }
    restoreEnv = mockedEnv(
      {
        TEAMCITY: 'true',
        TEAMCITY_PULL_REQUEST_BRANCH: 'myBranch',
        TEAMCITY_TARGET_BRANCH: 'master',
      },
      { clear: true },
    );

    const builder = makeBuilder(TestBuilder);
    const result = await builder.run();
    result.fold(
      (err) => expect(err.message).to.equal('verifyNonRelease error'),
      () => assert(false, 'should have failed'),
    );

    checkLogs(builder.logSpy, [
      ['test'],
      ['Handling pull request'],
      ['beforeVerifyPullRequest'],
      ['verifyNonRelease'],
    ]);
  });

  it('fail - verifyRelease', async () => {
    class TestBuilder extends Builder {
      async verifyRelease(): Promise<StepResult> {
        await super.verifyRelease();
        return this.io.failure('verifyRelease error');
      }
    }
    restoreEnv = mockedEnv(
      {
        TEAMCITY: 'true',
        TEAMCITY_PULL_REQUEST_BRANCH: 'release',
        TEAMCITY_TARGET_BRANCH: 'master',
      },
      { clear: true },
    );

    const builder = makeBuilder(TestBuilder);
    const result = await builder.run();
    result.fold(
      (err) => expect(err.message).to.equal('verifyRelease error'),
      () => assert(false, 'should have failed'),
    );

    checkLogs(builder.logSpy, [
      ['test'],
      ['Handling pull request'],
      ['beforeVerifyPullRequest'],
      ['verifyRelease'],
    ]);
  });

  it('fail - afterVerifyPullRequest', async () => {
    class TestBuilder extends Builder {
      async afterVerifyPullRequest(): Promise<StepResult> {
        await super.afterVerifyPullRequest();
        return this.io.failure('afterVerifyPullRequest error');
      }
    }
    restoreEnv = mockedEnv(
      {
        TEAMCITY: 'true',
        TEAMCITY_PULL_REQUEST_BRANCH: 'release',
        TEAMCITY_TARGET_BRANCH: 'master',
      },
      { clear: true },
    );

    const builder = makeBuilder(TestBuilder);
    await builder.run();

    checkLogs(builder.logSpy, [
      ['test'],
      ['Handling pull request'],
      ['beforeVerifyPullRequest'],
      ['verifyRelease'],
      ['afterVerifyPullRequest'],
      [
        "##teamcity[message text='afterVerifyPullRequest error' status='WARNING']",
      ],
    ]);
  });

  it('fail - afterVerifyPullRequest (OTHER CI)', async () => {
    class TestBuilder extends Builder {
      async afterVerifyPullRequest(): Promise<StepResult> {
        await super.afterVerifyPullRequest();
        return this.io.failure('afterVerifyPullRequest error');
      }
    }
    Environment.mapping['OTHER'] = () => ({
      projectName: getEnv(TC.TEAMCITY_PROJECT_NAME).getOrElse(''),
      configName: getEnv(TC.TEAMCITY_BUILDCONF_NAME).getOrElse(''),
      buildId: getEnv(TC.TEAMCITY_BUILD_ID).getOrElse(''),
      buildNumber: getEnv(TC.TEAMCITY_BUILD_NUMBER).getOrElse(''),
      pullRequestBranch: getEnv(TC.TEAMCITY_PULL_REQUEST_BRANCH).getOrElse(''),
      pullRequestNumber: getEnv(TC.TEAMCITY_PULL_REQUEST_NUMBER).getOrElse(''),
      targetBranch: getEnv(TC.TEAMCITY_TARGET_BRANCH).getOrElse(''),
      commitMessage: getEnv(TC.TEAMCITY_COMMIT_MESSAGE).getOrElse(''),
      commit: '',
    });
    restoreEnv = mockedEnv(
      {
        CI: 'true',
        TEAMCITY_PULL_REQUEST_BRANCH: 'release',
        TEAMCITY_TARGET_BRANCH: 'master',
      },
      { clear: true },
    );

    const builder = makeBuilder(TestBuilder);
    await builder.run();

    checkLogs(builder.logSpy, [
      ['test'],
      ['Handling pull request'],
      ['beforeVerifyPullRequest'],
      ['verifyRelease'],
      ['afterVerifyPullRequest'],
      [`${warning}afterVerifyPullRequest error`],
    ]);
  });

  it('success - non-release', async () => {
    class TestBuilder extends Builder {}
    restoreEnv = mockedEnv(
      {
        TEAMCITY: 'true',
        TEAMCITY_PULL_REQUEST_BRANCH: 'myBranch',
        TEAMCITY_TARGET_BRANCH: 'master',
      },
      { clear: true },
    );

    const builder = makeBuilder(TestBuilder);
    await builder.run();

    checkLogs(builder.logSpy, [
      ['test'],
      ['Handling pull request'],
      ['beforeVerifyPullRequest'],
      ['verifyNonRelease'],
      ['afterVerifyPullRequest'],
    ]);
  });

  it('success - release', async () => {
    class TestBuilder extends Builder {}
    restoreEnv = mockedEnv(
      {
        TEAMCITY: 'true',
        TEAMCITY_PULL_REQUEST_BRANCH: 'release',
        TEAMCITY_TARGET_BRANCH: 'master',
      },
      { clear: true },
    );

    const builder = makeBuilder(TestBuilder);
    await builder.run();

    checkLogs(builder.logSpy, [
      ['test'],
      ['Handling pull request'],
      ['beforeVerifyPullRequest'],
      ['verifyRelease'],
      ['afterVerifyPullRequest'],
    ]);
  });
});
