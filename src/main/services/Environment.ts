import * as semver from 'semver';
import {
  getTravisEnvironment,
  getTeamCityEnvironment,
  IPackageInfo,
  getEnv,
  TC,
  ENV,
  TRAVIS,
  IEnvironment,
} from './environments';

import {
  Option,
  Maybe,
  Either,
  Some,
  Try,
  Success,
  Failure,
  evalIteration,
  Left,
} from '@ioffice/fp';
import { Exception, util } from '../util';

/**
 * The CI Tools this project currently supports.
 */
enum CI {
  TEAMCITY = 'TEAMCITY',
  TRAVIS = 'TRAVIS',
  OTHER = 'OTHER',
  NONE = 'NONE',
}

/**
 * Provides all the build information regardless of the CI Tool.
 */
class Environment {
  static mapping: Record<string, () => IEnvironment> = {
    TRAVIS: getTravisEnvironment,
    TEAMCITY: getTeamCityEnvironment,
    NONE: (): IEnvironment => ({
      projectName: '',
      configName: '',
      buildId: '',
      buildNumber: '',
      pullRequestBranch: '',
      pullRequestNumber: '',
      targetBranch: '',
      commitMessage: '',
      commit: '',
    }),
  };

  /**
   * A enum representing the CI Tool in use.
   */
  readonly ci: CI = getEnv(TC.TEAMCITY)
    .map((_) => CI.TEAMCITY)
    .orElse((_) => getEnv(TRAVIS.TRAVIS).map((_) => CI.TRAVIS))
    .orElse((_) => getEnv(ENV.CI).map((_) => CI.OTHER))
    .getOrElse(CI.NONE);

  /**
   * The project name as provided the CI Tool.
   */
  readonly projectName: string;

  /**
   * The build configuration name of the CI Tool.
   */
  readonly configName: string;

  /**
   * The id of the current build that CI uses internally.
   */
  readonly buildId: string;

  /**
   * The number of the current build (for example, "4").
   */
  readonly buildNumber: string;

  /**
   * If the current job is a pull request, the name of the branch from which the
   * PR originated.
   */
  readonly pullRequestBranch: string;

  /**
   * The pull request number if the current job is a pull request.
   */
  readonly pullRequestNumber: string;

  /**
   * For push builds, or builds not triggered by a pull request, this is the
   * name of the branch. For builds triggered by a pull request this is the name
   * of the branch targeted by the pull request.
   */
  readonly targetBranch: string;

  /**
   * The commit subject and body, unwrapped.
   */
  readonly commitMessage: string;

  /**
   * The commit that the current build is testing.
   */
  readonly commit: string;

  /**
   * A github access token. This is used to push tags to GitHub.
   *
   * https://help.github.com/en/articles/creating-a-personal-access-token-for-the-command-line
   */
  readonly githubToken: string = getEnv(ENV.GITHUB_TOKEN).getOrElse('');

  /**
   * A list of slack channels that need to be sent notifications.
   */
  readonly slackChannels: string[] = Object.keys(process.env)
    .filter((key) => key.startsWith('SLACK_CHANNEL_'))
    .map((channel) => process.env[channel] || '')
    .filter((x) => x);

  /**
   * `true` if the builder is meant to setup a release.
   */
  readonly isReleaseSetup: boolean = getEnv(ENV.RELEASE_SETUP)
    .map((x) => !!x)
    .getOrElse(false);

  /**
   * `true` if the builder is meant to create a pre release of the project.
   */
  readonly isPreRelease: boolean = getEnv(ENV.PRE_RELEASE)
    .map((x) => !!x)
    .getOrElse(false);

  /**
   * The "name" field found in the `package.json`.
   */
  readonly packageName: string;

  /**
   * The "version" field found in the `package.json`.
   */
  readonly packageVersion: string;

  /**
   * The owner of the git repository.
   */
  readonly owner: string;

  /**
   * The git repository name.
   */
  readonly repo: string;

  /**
   * The contents of `package.json`.
   */
  readonly package: unknown;

  /**
   * A possible exception that may have been encountered during the creation
   * of this service.
   */
  readonly error: Option<Exception>;

  constructor() {
    const pkgInfo = this.getPackageInfo();
    const pkg = pkgInfo.getOrElse({
      name: '',
      version: '',
      owner: '',
      repo: '',
      data: {},
    });
    const envInfo = Try(() => Environment.mapping[this.ci]()).toEither();
    const env = envInfo.getOrElse({
      projectName: '',
      configName: '',
      buildId: '',
      buildNumber: '',
      pullRequestBranch: '',
      pullRequestNumber: '',
      targetBranch: '',
      commitMessage: '',
      commit: '',
    });

    this.projectName = env.projectName;
    this.configName = env.configName;
    this.buildId = env.buildId;
    this.buildNumber = env.buildNumber;
    this.pullRequestBranch = env.pullRequestBranch;
    this.pullRequestNumber = env.pullRequestNumber;
    this.targetBranch = env.targetBranch;
    this.commitMessage = env.commitMessage;
    this.commit = env.commit;

    this.packageName = pkg.name;
    this.packageVersion = pkg.version;
    this.owner = pkg.owner;
    this.repo = pkg.repo;
    this.package = pkg.data;
    this.error = pkgInfo.swap().toOption();
  }

  /**
   * Attempt to obtain a raw object by reading the project's `package.json`
   * file.
   */
  readPackage(): Either<Exception, unknown> {
    return util.readJSON('./package.json');
  }

  private getRepoInfo(pkg: object): Either<Exception, [string, string]> {
    return Maybe(pkg['repository'])
      .flatMap((x) => (typeof x !== 'string' ? Maybe(x['url']) : Some(x)))
      .toRight(new Exception('missing "repository" field in "package.json"'))
      .flatMap((url) =>
        Try((_) => Maybe(url.match(/(.*)[\/:](.*)\/(.*)\.git$/)))
          .transform(
            (opt) =>
              opt.fold(
                () =>
                  Failure<[string, string]>(
                    new Exception({
                      message: 'failed to match on git url',
                      data: { url },
                    }),
                  ),
                (parts) => Success([parts[2], parts[3]] as [string, string]),
              ),
            (err) =>
              Failure(
                new Exception(
                  { message: 'failed to match on git url', data: { url } },
                  err,
                ),
              ),
          )
          .toEither(),
      );
  }

  private getPackageInfo(): Either<Exception, IPackageInfo> {
    return evalIteration<Exception, IPackageInfo>(() => {
      for (const pkg of this.readPackage())
        for (const name of Maybe((pkg as object)['name']).toRight(
          new Exception('package.json missing "name" field'),
        ))
          for (const version of this.getPackageVersion(pkg as object))
            for (const [owner, repo] of this.getRepoInfo(pkg as object))
              return { name, version, owner, repo, data: pkg };
    });
  }

  private getPackageVersion(pkg: object): Either<Exception, string> {
    return evalIteration(() => {
      for (const version of Maybe(pkg['version']).toRight(
        new Exception('package.json missing "version" field'),
      )) {
        if (!semver.parse(version)) {
          throw Left(
            new Exception(
              `package.json "version" field is not parsable: ${version}`,
            ),
          );
        }
        return version;
      }
    });
  }
}

export { CI, Environment };
