import { Either } from '../fp';
import { Exception } from '../util';

/**
 * Interface to store the current and new versions of the package during the
 * release setup process.
 */
interface IReleaseInfo {
  /**
   * The current version of the package.
   */
  currentVersion: string;

  /**
   * The new version to be released.
   */
  newVersion: string;
}

/**
 * A step result is either an exception or the number 0.
 */
type StepResult = Either<Exception, 0>;

/**
 * A step result inside a promise.
 */
type AsyncStepResult = Promise<StepResult>;

/**
 * Wrapper for the exit code of a program.
 */
interface IProgramExitCode {
  code: number;
}

/**
 * States all the possible build steps.
 */
enum BStep {
  ciBuilder,
  nonCI,
  test,
  preRelease,
  releaseSetup,
  beforeVerifyPullRequest,
  verifyRelease,
  verifyNonRelease,
  afterVerifyPullRequest,
  beforePublish,
  publish,
  afterPublish,
}

/**
 * A build step.
 */
interface IBStep<I = unknown> {
  /**
   * The name of the step.
   */
  name: string;

  /**
   * Short description for the build step.
   */
  description: string;

  /**
   * The method to execute during this step.
   * @param arg An argument to provide to the method.
   */
  method: (arg: I) => AsyncStepResult;
}

export {
  StepResult,
  AsyncStepResult,
  IReleaseInfo,
  BStep,
  IBStep,
  IProgramExitCode,
};
