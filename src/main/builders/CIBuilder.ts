import {
  BuildUtil,
  CI,
  Environment,
  Git,
  Github,
  IO,
  Provider,
  Yarn,
} from '../services';
import {
  IReleaseInfo,
  StepResult,
  AsyncStepResult,
  IBStep,
  BStep,
} from './Types';
import { Exception } from '../util';
import { Either, ifElseChain, Right, asyncEvalIteration } from '@ioffice/fp';

/**
 * The `CIBuilder` defines the basic flows to run under a CI environment and
 * a local (dev) environment.
 */
abstract class CIBuilder {
  /**
   * A string representation of one of the steps defined by the `BStep` enum.
   */
  step = 'init';

  /**
   * List of steps which resulted in failures.
   */
  readonly failureSteps: string[] = [];

  /**
   * A reference to the IO service used to initialize the builder.
   */
  readonly io: IO;

  /**
   * A reference to the Environment service used to initialize the builder.
   */
  readonly env: Environment;

  /**
   * A reference to the Git service used to initialize the builder.
   */
  readonly git: Git;

  /**
   * A reference to the Github service used to initialize the builder.
   */
  readonly github: Github;

  /**
   * A reference to the Yarn service used to initialize the builder.
   */
  readonly yarn: Yarn;

  /**
   * A reference to the BuildUtil service used to initialize the builder.
   */
  readonly buildUtil: BuildUtil;

  /**
   * All the possible steps during the build.
   */
  private readonly buildStep: Record<number, IBStep>;

  constructor(
    env?: Environment,
    io?: IO,
    git?: Git,
    github?: Github,
    yarn?: Yarn,
    buildUtil?: BuildUtil,
  ) {
    // Provider.getInstance() is cached so no penalty in calling the function.
    // Do not store the instance first, otherwise it will try to initialize the
    // env service which will result in unnecessary work if an instance is
    // provided by the constructor.
    this.env = env || Provider.getInstance().env;
    this.io = io || Provider.getInstance().io;
    this.git = git || Provider.getInstance().git;
    this.github = github || Provider.getInstance().github;
    this.yarn = yarn || Provider.getInstance().yarn;
    this.buildUtil = buildUtil || Provider.getInstance().buildUtil;
    this.buildStep = {
      [BStep.ciBuilder]: {
        name: 'CI-Builder',
        description: 'running ci-builder',
        method: this.runBuilder.bind(this),
      },
      [BStep.nonCI]: {
        name: 'Non-CI',
        description: 'running in a non CI environment',
        method: this.runNonCI.bind(this),
      },
      [BStep.test]: {
        name: 'test',
        description: 'running tests',
        method: this.test.bind(this),
      },
      [BStep.preRelease]: {
        name: 'preRelease',
        description: 'running pre-release',
        method: this.createPreRelease.bind(this),
      },
      [BStep.startRelease]: {
        name: 'startRelease',
        description: 'starting the release-setup',
        method: this.runReleaseSetup.bind(this),
      },
      [BStep.releaseSetup]: {
        name: 'releaseSetup',
        description: 'running release-setup hook',
        method: this.releaseSetup.bind(this),
      },
      [BStep.beforeVerifyPullRequest]: {
        name: 'beforeVerifyPullRequest',
        description: 'running beforeVerifyPullRequest',
        method: this.beforeVerifyPullRequest.bind(this),
      },
      [BStep.verifyRelease]: {
        name: 'verifyRelease',
        description: 'verifying release',
        method: this.verifyRelease.bind(this),
      },
      [BStep.verifyNonRelease]: {
        name: 'verifyNonRelease',
        description: 'verifying non-release',
        method: this.verifyNonRelease.bind(this),
      },
      [BStep.afterVerifyPullRequest]: {
        name: 'afterVerifyPullRequest',
        description: 'running afterVerifyPullRequest',
        method: this.afterVerifyPullRequest.bind(this),
      },
      [BStep.beforePublish]: {
        name: 'beforePublish',
        description: 'running before publish',
        method: this.beforePublish.bind(this),
      },
      [BStep.publish]: {
        name: 'publish',
        description: '',
        method: this.publish.bind(this),
      },
      [BStep.afterPublish]: {
        name: 'afterPublish',
        description: 'running after publish',
        method: this.afterPublish.bind(this),
      },
    };
  }

  /**
   * This is the main method to execute. There is no need to run any of the
   * other defined methods since this method will call them depending on the
   * environment variables.
   */
  async run(): Promise<StepResult> {
    const env = this.env;

    return ifElseChain(
      [env.error.isDefined, async _ => env.error.toLeft(0 as 0)],
      [env.ci === CI.NONE, _ => this.runStep(this.buildStep[BStep.nonCI])],
    ).getOrElse(_ => this.runStep(this.buildStep[BStep.ciBuilder]));
  }

  /**
   * Build steps that are allowed to run in a non CI environment.
   */
  private async runNonCI(): Promise<StepResult> {
    const { isPreRelease, isReleaseSetup } = this.env;

    return ifElseChain(
      [isPreRelease, _ => this.runStep(this.buildStep[BStep.preRelease])],
      [isReleaseSetup, _ => this.runStep(this.buildStep[BStep.startRelease])],
    ).getOrElse(_ => this.runStep(this.buildStep[BStep.test]));
  }

  /**
   * Gets called whenever we want to create a release. The implementation
   * should define the operations that need to be done to help the user create
   * a release of the library.
   */
  abstract releaseSetup(param: IReleaseInfo): AsyncStepResult;

  /**
   * Gets called right before the `publish` method. This is the place where we
   * can rearrange files in the appropriate directories.
   */
  abstract beforePublish(): AsyncStepResult;

  /**
   * Should define how the library gets published.
   */
  abstract publish(): AsyncStepResult;

  /**
   * Gets called after the `publish` method. Failure in this method will not
   * affect the end result of the process since the package has already been
   * published. We can use this method to send notifications or to create github
   * releases.
   */
  abstract afterPublish(): AsyncStepResult;

  /**
   * Specify how to run the unit tests.
   */
  abstract test(): AsyncStepResult;

  /**
   * This gets run before `verifyRelease` or `verifyNonRelease` gets run.
   * This will run on any PR.
   */
  abstract beforeVerifyPullRequest(): AsyncStepResult;

  /**
   * This method gets called when a branch named `release` is in a pull request.
   * Here we can make sure that the version number is greater than the currently
   * published one. We can also check that the CHANGELOG has been updated.
   */
  abstract verifyRelease(): AsyncStepResult;

  /**
   * Similarly to `verifyRelease` this method gets called on any other pull
   * request. Here we can make sure that the package version has not been
   * modified.
   */
  abstract verifyNonRelease(): AsyncStepResult;

  /**
   * This gets run after `verifyRelease` or `verifyNonRelease` gets run. This
   * will run on any PR.
   */
  abstract afterVerifyPullRequest(): AsyncStepResult;

  /**
   * State if a build on a branch with a given commit message should trigger
   * a release.
   *
   * @param branch
   * @param commitMsg
   */
  abstract isRelease(branch: string, commitMsg: string): Promise<boolean>;

  /**
   * State if the PR should be treated as a release verification or not. This
   * will determine if `verifyRelease` is used (if it returns `true`) or
   * `verifyNonRelease` if it return `false`.
   *
   * @param pullRequestBranch The branch name of the PR.
   */
  abstract isReleasePullRequest(pullRequestBranch: string): Promise<boolean>;

  /**
   * Verifies that there the file list is empty.
   */
  protected async verifyNonCommittedFiles(
    files: string[],
  ): Promise<StepResult> {
    const list = `\n  ${files.join('\n  ')}`;
    return files.length > 0
      ? this.io.failure(`Commit the following files:${list}`)
      : Right(0);
  }

  /**
   * Return an either with an exception stating that the current branch is not
   * the required branch. Otherwise, a `Right(0)` representing that everything
   * is ok.
   */
  private async requireBranch(
    current: string,
    requiredBranch: string,
  ): Promise<StepResult> {
    const msg = `'${current}' is not the required branch '${requiredBranch}'`;
    return current === requiredBranch ? Right(0) : this.io.failure(msg);
  }

  /**
   * Create a standard pre-release of the current state of the project. This
   * command will work on any machine that has the valid credentials. A
   * successful preRelease will do the following:
   *
   * - Switch to the '__build' branch
   * - Run `beforePublish`
   * - Run `publish`
   * - Switch back to you working branch
   * - Delete the '__build' branch.
   *
   * Note that `afterPublish` does not get called since pre-releases are meant
   * to be kept in the down low.
   */
  protected async createPreRelease(): Promise<StepResult> {
    const branchEither = await asyncEvalIteration<Exception, string>(
      async () => {
        for (const files of await this.git.getModifiedFiles())
          for (const _ of await this.verifyNonCommittedFiles(files))
            for (const branch of await this.git.getBranch())
              for (const _ of await this.git.switchBranch('__build', true))
                return branch;
      },
    );

    // no point moving forward since we were unable to switch to build branch
    if (branchEither.isLeft) return branchEither.map(_ => 0 as 0);

    const result = (
      await asyncEvalIteration<Exception, 0>(async () => {
        for (const _ of await this.runStep(this.buildStep[BStep.beforePublish]))
          for (const _ of await this.runStep(this.buildStep[BStep.publish]))
            for (const _ of await this.io.success(0, 'Pre-release successful'))
              return 0;
      })
    ).mapIfLeft(err => {
      this.io.error(err, false);
      return err;
    });

    (
      await asyncEvalIteration<Exception, 0>(async () => {
        for (const branch of branchEither)
          for (const _ of await this.git.switchAndDelete(branch, '__build'))
            return 0;
      })
    ).mapIfLeft(err => this.io.warn(err));

    return result;
  }

  /**
   * Setup the release process. It calls the `releaseSetup` method specified in
   * the derived builders. An `IReleaseInfo` object will be passed into the
   * method so that we may be able to modify files related to the release. For
   * NPM builds for instance we care about modifying:
   *
   * - package.json changes the version
   * - README.md needs to be replaced all occurrences of the old version for the
   *             new one.
   * - CHANGELOG.md needs to set up the links
   *
   * After this is done we will be in the `release` branch. It is our
   * responsibility to make sure that the setup was done correctly and finish
   * writing any remaining information to continue with the release process.
   */
  protected async runReleaseSetup(): Promise<StepResult> {
    // TODO: lets make sure everything is pushed.
    await asyncEvalIteration(async () => {
      for (const currentBranch of await this.git.getBranch())
        for (const _ of await this.requireBranch(currentBranch, 'master'))
          for (const files of await this.git.getModifiedFiles())
            for (const _ of await this.verifyNonCommittedFiles(files)) return 0;
    });

    const currentVer = this.env.packageVersion;
    return asyncEvalIteration<Exception, 0>(async () => {
      for (const newVer of await this.io.promptForNewVersion(currentVer))
        for (const _ of await this.git.switchBranch('release', true))
          for (const _ of await this.runStep<IReleaseInfo>(
            this.buildStep[BStep.releaseSetup],
            {
              currentVersion: currentVer,
              newVersion: newVer,
            },
          ))
            for (const _ of this.io.log(`setup for version ${newVer} complete`))
              return 0;
    });
  }

  private async runBuilder(): Promise<StepResult> {
    const testRes = await this.runStep(this.buildStep[BStep.test]);
    if (testRes.isLeft) return testRes;

    const isPR = this.env.pullRequestBranch !== '';
    return isPR ? this.handlePullRequest() : this.handleBranch();
  }

  protected async handleBranch(): Promise<StepResult> {
    const { targetBranch: branch, commitMessage } = this.env;
    this.io.log(`New changes on '${branch}' branch.`);
    if (!(await this.isRelease(branch, commitMessage))) {
      const msg = JSON.stringify(commitMessage);
      return this.io.log(
        `Skipping release on '${branch}' branch.\nLast commit message: ${msg}`,
      );
    }

    this.io
      .setLogFileReleaseFlag()
      .swap()
      .forEach(err => this.io.warn(err));

    const publishResult = await asyncEvalIteration<Exception, 0>(async () => {
      for (const _ of await this.runStep(this.buildStep[BStep.beforePublish]))
        for (const _ of await this.runStep(this.buildStep[BStep.publish]))
          return 0;
    });
    if (publishResult.isLeft) return publishResult;

    const version = this.env.packageVersion;
    this.io.log(`Released version ${version}`);

    (await this.runStep(this.buildStep[BStep.afterPublish]))
      .swap()
      .forEach(err => this.io.warn(err));

    return Right(0);
  }

  protected async handlePullRequest(): Promise<Either<Exception, 0>> {
    this.io.log('Handling pull request');
    const isReleasePR = await this.isReleasePullRequest(
      this.env.pullRequestBranch,
    );
    const verificationType = isReleasePR
      ? BStep.verifyRelease
      : BStep.verifyNonRelease;

    const verifyResult = await asyncEvalIteration<Exception, 0>(async () => {
      for (const _ of await this.runStep(
        this.buildStep[BStep.beforeVerifyPullRequest],
      ))
        for (const _ of await this.runStep(this.buildStep[verificationType]))
          return 0;
    });
    if (verifyResult.isLeft) return verifyResult;

    (await this.runStep(this.buildStep[BStep.afterVerifyPullRequest]))
      .swap()
      .forEach(err => this.io.warn(err));

    return Right(0);
  }

  private async runStep<I>(
    step: IBStep,
    arg?: I,
  ): Promise<Either<Exception, 0>> {
    this.io.openBlock(step.name, step.description);
    this.step = step.name;
    const result = await step.method.call(this, arg);
    this.step = step.name;
    this.io.closeBlock(step.name);
    if (result.isLeft) {
      this.failureSteps.push(step.name);
    }
    return result;
  }
}

interface IBuilder {
  new (
    env?: Environment,
    io?: IO,
    git?: Git,
    github?: Github,
    yarn?: Yarn,
    buildUtil?: BuildUtil,
  ): CIBuilder;
}

export { CIBuilder, IBuilder, StepResult };
