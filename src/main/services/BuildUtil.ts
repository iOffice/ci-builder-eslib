import * as semver from 'semver';
import { SemVer } from 'semver';

import { Environment } from './Environment';
import { Yarn } from './Yarn';
import { IO } from './IO';
import { Git } from './Git';
import { Github } from './Github';
import { StepResult } from '../builders';
import { Either, Left, Right, asyncPipeEither } from '@ioffice/fp';
import { Exception, util } from '../util';

class BuildUtil {
  constructor(
    private env: Environment,
    private io: IO,
    private git: Git,
    private github: Github,
    private yarn: Yarn,
  ) {}

  /**
   * Verify that the package version has not been modified. It does this by
   * fetching the latest version stored in the npm registry and making sure
   * that it matches the one in the package.json.
   *
   * This may be useful to make sure that non release PRs do not "accidentally"
   * change the package version.
   */
  async verifyUntouchedPackageVersion(): Promise<StepResult> {
    const pkgVersion = this.env.packageVersion;

    const semVerEither = await asyncPipeEither(
      _ => this.yarn.getVersion(),
      ([version]) => util.toSemVer(version),
    );

    if (semVerEither.isLeft) return semVerEither.map(_ => 0 as 0);
    const semVer = semVerEither.value as SemVer;

    if (semVer.prerelease.length > 0) {
      return this.io.log('Package has only been pre-released');
    } else if (!semver.eq(pkgVersion, semVer)) {
      return this.io.failure(
        'Modifications to package version are not allowed',
      );
    }

    return this.io.success(0);
  }

  /**
   * Verify that the package version has been updated to a valid new version.
   * It does this by making sure that the version specified in the package.json
   * file is greater than the version in the npm registry.
   *
   * This may be useful to make sure that a release PR did not forget to change
   * the version.
   */
  async verifyNewPackageVersion(): Promise<StepResult> {
    const pkgVersion = this.env.packageVersion;

    const semVerEither = await asyncPipeEither(
      _ => this.yarn.getVersion(),
      ([version]) => util.toSemVer(version),
    );

    if (semVerEither.isLeft) return semVerEither.map(_ => 0 as 0);
    const semVer = semVerEither.value as SemVer;

    if (!semver.gt(pkgVersion, semVer)) {
      return this.io.failure(`Package version needs to be > ${semVer.raw}`);
    }

    return this.io.success(0);
  }

  /**
   * Adds an entry to the change log file with the new version that is begin
   * released and updates all the links to the versions.
   *
   * @param newVersion The version of the new entry to add.
   * @param changeLogFile Path to the change log. Defaults to './CHANGELOG.md'
   */
  async updateChangeLog(
    newVersion: string,
    changeLogFile: string = './CHANGELOG.md',
  ): Promise<StepResult> {
    return asyncPipeEither(
      _ => util.readFile(changeLogFile),
      _ => this.git.getFirstCommit(),
      ([data, commit]) => this.modifiedChangeLog(data, newVersion, commit),
      ([, , newData]) => util.writeFile(newData, changeLogFile),
    );
  }

  /**
   * README files in iOFFICE projects contain links to the documentation and
   * these links point to specific versions. For this reason we must update the
   * links so that any instance that points to the current version will now
   * point to the new one.
   *
   * @param currentVersion The current version of the package.
   * @param newVersion The new version we are releasing.
   */
  async replaceVersionsInREADME(
    currentVersion: string,
    newVersion: string,
  ): Promise<StepResult> {
    const readmeFile = './README.md';
    return asyncPipeEither(
      _ => util.readFile(readmeFile),
      ([data]) =>
        util.writeFile(
          this.modifiedREADME(data, currentVersion, newVersion),
          readmeFile,
        ),
    );
  }

  /**
   * Makes sure that every version has an entry and that each entry is a link to
   * the comparison of the repo.
   *
   * @param content The content of the CHANGELOG.md file.
   * @param newVersion The new version we are releasing.
   * @param firstCommit The very first commit hash of the repo.
   */
  private modifiedChangeLog(
    content: string,
    newVersion: string,
    firstCommit: string,
  ): Either<Exception, string> {
    const [header, main] = content.split('## [Unreleased]');
    if (!main) return Left(new Exception('Missing "Unreleased" link'));

    const [entries] = main.split('[Unreleased]:');
    const lines = entries.split('\n');
    const versions = lines
      .filter(x => x.startsWith('## ['))
      .map(line => (line.match(/## \[(.*)]/) || [])[1])
      .filter(x => x);
    versions.unshift(newVersion);
    versions.push(firstCommit);

    const links = [
      `[Unreleased]: ${this.github.getCompareLink(newVersion, 'HEAD')}`,
    ];
    for (let i = 0; i < versions.length - 1; i++) {
      links.push(
        `[${versions[i]}]: ${this.github.getCompareLink(
          versions[i + 1],
          versions[i],
        )}`,
      );
    }

    const date = new Date().toLocaleString('default', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

    return Right(
      [
        header,
        '## [Unreleased]\n\n',
        `## [${newVersion}] - ${date}\n\n`,
        entries,
        links.join('\n'),
        '\n',
      ].join(''),
    );
  }

  /**
   * Currently the README files in iOffice projects contain links to the
   * documentation and these links point to specific versions. For this reason
   * we must update the links so that any instance that points to the current
   * version will now point to the new one.
   *
   * @param content The content of the README file.
   * @param currentVersion The current version of the package.
   * @param newVersion The new version we are releasing.
   */
  private modifiedREADME(
    content: string,
    currentVersion: string,
    newVersion: string,
  ): string {
    return content.split(currentVersion).join(newVersion);
  }
}

export { BuildUtil };
