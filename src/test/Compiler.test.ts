import { expect } from 'chai';
import { Suite } from 'mocha';

import { ExitCode, compileProject, getProjectStatus } from '../main';
import { Some } from '../main/fp';

describe('Compiler', function compilerTest(this: Suite) {
  this.timeout(5000);

  it('should compile with no messages', () => {
    const results = compileProject(
      'src/test/fixtures/tsconfig.valid.json',
      Some('./src/test/fixtures/eslint.json'),
    );
    expect(results.numMessages).to.equal(0);
    const status = getProjectStatus(results, {});
    expect(status.status).to.eq(ExitCode.OK);
  });

  it('should compile with errors', () => {
    const results = compileProject(
      'src/test/fixtures/tsconfig.only-errors.json',
      Some('./src/test/fixtures/eslint.json'),
    );
    expect(results.numMessages).to.equal(1);
    expect(results.numErrors).to.equal(1);
    expect(results.numWarnings).to.equal(0);
    const error = results.byMessage['TS2322'];
    expect(error).to.not.equal(undefined);
    expect(error.count).to.eq(1);
    const status = getProjectStatus(results, {});
    expect(status.status).to.eq(ExitCode.ERROR);
  });

  it('should compile with warnings', () => {
    const results = compileProject(
      'src/test/fixtures/tsconfig.only-warnings.json',
      Some('./src/test/fixtures/eslint.json'),
    );
    expect(results.numMessages).to.equal(1);
    expect(results.numErrors).to.equal(0);
    expect(results.numWarnings).to.equal(1);
    const warning = results.byMessage['max-len'];
    expect(warning).to.not.equal(undefined);
    expect(warning.count).to.eq(1);
    const status = getProjectStatus(results, {});
    expect(status.status).to.eq(ExitCode.WARNING);
  });

  it('should compile with both errors and warnings', () => {
    const results = compileProject(
      'src/test/fixtures/tsconfig.errors-and-warnings.json',
      Some('./src/test/fixtures/eslint.json'),
    );
    expect(results.numMessages).to.equal(2);
    expect(results.numErrors).to.equal(1);
    expect(results.numWarnings).to.equal(1);
    const error = results.byMessage['TS2322'];
    const warning = results.byMessage['max-len'];
    expect(error).to.not.equal(undefined);
    expect(error.count).to.eq(1);
    expect(warning).to.not.equal(undefined);
    expect(warning.count).to.eq(1);
    const status = getProjectStatus(results, {});
    expect(status.status).to.eq(ExitCode.ERROR);
  });

  it('should handle error exceptions', () => {
    const results = compileProject(
      'src/test/fixtures/tsconfig.multiple.json',
      Some('./src/test/fixtures/eslint.json'),
    );
    const statusA = getProjectStatus(results, {});
    expect(statusA.status).to.eq(ExitCode.ERROR, 'StatusA is not ERROR');

    const statusB = getProjectStatus(results, {
      'max-len': 0,
      TS6133: 0,
      TS7006: 0,
      TS2322: 0,
    });
    expect(statusB.status).to.eq(
      ExitCode.ERROR_EXCEPTION,
      'StatusB is not ERROR_EXCEPTION',
    );

    const statusC = getProjectStatus(results, {
      'max-len': 0,
      TS6133: 6,
      TS7006: 1,
      TS2322: 1,
    });
    expect(statusC.status).to.eq(
      ExitCode.WARNING_EXCEPTION,
      'StatusC is not WARNING_EXCEPTION',
    );

    const statusD = getProjectStatus(results, {
      'max-len': 6,
      TS6133: 6,
      TS7006: 1,
      TS2322: 1,
    });
    expect(statusD.status).to.eq(ExitCode.OK, 'StatusD is not OK');

    const statusE = getProjectStatus(results, {
      'max-len': 6,
      TS6133: 6,
      TS2322: 1,
    });
    expect(statusE.status).to.eq(ExitCode.ERROR, 'StatusE is not OK');

    const statusF = getProjectStatus(results, {
      TS6133: 7,
      TS7006: 1,
      TS2322: 1,
    });
    expect(statusF.status).to.eq(ExitCode.WARNING, 'StatusD is not OK');
  });
});
