import { checkLogs, Builder, makeBuilder } from './Helper';
import { StepResult } from '../../main';
import { expect, assert } from 'chai';
import { default as mockedEnv } from 'mocked-env';

describe('CIBuilder - Basic', () => {
  let restoreEnv: () => void = () => {};

  afterEach(() => {
    restoreEnv();
  });

  it('test fails', async () => {
    class TestBuilder extends Builder {
      async test(): Promise<StepResult> {
        this.io.log('(override) should fail');
        return this.io.failure('bad...');
      }
    }

    restoreEnv = mockedEnv({}, { clear: true });
    const builder = makeBuilder(TestBuilder);
    const result = await builder.run();
    result.fold(
      (err) => expect(err.message).to.equal('bad...'),
      () => assert(false, 'should have failed'),
    );

    checkLogs(builder.logSpy, [['(override) should fail']]);
  });

  it('no env variables', async () => {
    class TestBuilder extends Builder {
      async test(): Promise<StepResult> {
        return this.io.success(0, '(override) skipping tests');
      }
    }

    restoreEnv = mockedEnv({}, { clear: true });
    const builder = makeBuilder(TestBuilder);
    await builder.run();
    checkLogs(builder.logSpy, [['(override) skipping tests']]);
  });

  it('success', async () => {
    class TestBuilder extends Builder {
      async test(): Promise<StepResult> {
        await super.test();
        return this.io.success(0, '(override) skipping tests');
      }
    }

    restoreEnv = mockedEnv(
      {
        TEAMCITY: 'true',
        TEAMCITY_TARGET_BRANCH: 'random',
        TEAMCITY_COMMIT_MESSAGE: '[WIP] test message',
      },
      { clear: true },
    );

    const builder = makeBuilder(TestBuilder);
    await builder.run();
    expect(builder.env.owner).to.equal('iOffice');
    expect(builder.env.repo).to.equal('ci-builder-eslib');
    checkLogs(builder.logSpy, [
      ['test'],
      ['(override) skipping tests'],
      ["New changes on 'random' branch."],
      [
        'Skipping release on \'random\' branch.\nLast commit message: "[WIP] test message"',
      ],
    ]);
  });
});
