import * as colors from 'colors';
import * as semver from 'semver';
import { SemVer } from 'semver';

import { CI, Environment } from './Environment';
import {
  Either,
  Left,
  match,
  Maybe,
  Option,
  Right,
  Success,
  TryAsync,
  evalIteration,
} from '@ioffice/fp';
import {
  Exception,
  IException,
  IExceptionMessage,
  util,
  interceptWriteStreams,
} from '../util';

interface IBuilderMessages {
  isRelease?: boolean;
  warnings: [string, number][];
  errors: [string, number][];
}

class IO {
  static warnings: [string, number][] = [];
  static errors: [string, number][] = [];
  private logFile = './ciBuilder-log.json';
  private blocks: string[] = [];
  private restoreStreams?: () => void;

  constructor(private env: Environment) {}

  /**
   * Intercepts the process.stdout and process.stderr write methods to provide
   * block indentation in non CI environments.
   */
  enableLocalBlocks(): void {
    if (this.env.ci === CI.NONE) {
      this.blocks.push('local');
      this.restoreStreams = interceptWriteStreams(text => {
        const depth = this.blocks.length - 1;
        const padding = '  '.repeat(Math.max(depth, 0));
        const block = colors.grey(`[${this.blocks[depth]}]`);
        return text
          .replace(/\n$/, '')
          .split('\n')
          .map(x => `${padding}${block} ${x}`)
          .join('\n');
      });
    }
  }

  /**
   * Restores the original write methods for process.stdout and process.stderr
   * if `enableLocalBlocks` was previously called.
   */
  disableLocalBlocks(): void {
    if (this.restoreStreams) {
      this.restoreStreams();
      this.blocks = [];
    }
  }

  /**
   * Log a message to the console.
   */
  log(...msg: unknown[]): Either<Exception, 0> {
    console.log(...msg);
    return Right(0);
  }

  /**
   * Print a message of an Exception to the console and store the warning.
   */
  warn(err: Exception): Either<Exception, 0> {
    const msg = err.message;
    IO.warnings.push([msg, Date.now()]);
    // prettier-ignore
    const line = match(this.env.ci,
      [CI.TEAMCITY, _ => `##teamcity[message text='${this.escapeTC(msg)}' status='WARNING']`],
      [CI.TRAVIS, _ => `##buildWarning: ${msg}`],
    ).getOrElse(colors.yellow('WARNING: ') + msg);
    return this.log(line);
  }

  /**
   * Prints a message to the console and stores the error.
   */
  error(err: Exception, dumpException = true): Either<Exception, 0> {
    const msg = err.message;
    IO.errors.push([msg, Date.now()]);
    // prettier-ignore
    const line = match(this.env.ci,
      [CI.TEAMCITY, _ => `##teamcity[buildProblem description='${this.escapeTC(msg)}']`],
      [CI.TRAVIS, _ => `##buildFailure: ${msg}`],
    ).getOrElse(colors.red('ERROR: ') + `${msg}`);
    this.log(line);
    if (dumpException) {
      this.log(JSON.stringify(err.toObject(), null, 2));
    }
    return Left(err);
  }

  /**
   * Utility to return a value and logging a message.
   */
  async success<T>(value: T, msg?: string): Promise<Either<Exception, T>> {
    if (msg) this.log(msg);
    return Right(value);
  }

  /**
   * To be used to pass a rejected promise down a chain of promises.
   *
   * Sample usage:
   *
   * ```
   * failure('fail reason');
   * failure({ message: 'fail reason', data: { a, b } });
   * failure('fail reason', err);
   * failure(new Exception(...));
   * ```
   */
  async failure<T>(
    err: string | IExceptionMessage<unknown> | Exception,
    exception?: IException,
  ): Promise<Either<Exception, T>> {
    if (exception && !(err instanceof Exception)) {
      return Left(new Exception(err, exception));
    }
    if (err instanceof Exception) {
      return Left(err);
    }
    return Left(new Exception(err));
  }

  /**
   * Depending on the tool we may be able to open a block to help us identify
   * log messages.
   */
  openBlock(name: string, desc: string): void {
    const ifTC = (): string =>
      `##teamcity[blockOpened name='${name}' description='${this.escapeTC(
        desc,
      )}']`;
    const ifTravis = (): string =>
      `travis_fold:start:${name}${desc ? `\n${colors.yellow(desc)}` : ''}`;
    const ifOther = (): string => `${name}${desc ? `: ${desc}` : ''}`;

    // prettier-ignore
    const line = match(
      this.env.ci,
      [CI.TEAMCITY, ifTC],
      [CI.TRAVIS, ifTravis]
    ).getOrElse(ifOther);

    this.log(line);
    this.blocks.push(name);
  }

  closeBlock(name: string): void {
    while (this.blocks.length && this.blocks[this.blocks.length - 1] !== name) {
      this.blocks.pop();
    }
    this.blocks.pop();

    // prettier-ignore
    match(this.env.ci,
      [CI.TEAMCITY, _ => `##teamcity[blockClosed name='${name}']`],
      [CI.TRAVIS, _ => `travis_fold:end:${name}`],
    ).forEach(line => this.log(line));
  }

  /**
   * Teamcity requires certain characters to be escaped when we use service
   * messages. See
   * https://confluence.jetbrains.com/display/TCD10/Build+Script+Interaction+with+TeamCity#BuildScriptInteractionwithTeamCity-Escapedvalues
   */
  escapeTC(msg: string): string {
    return msg
      .replace(/\|/g, '||')
      .replace(/'/g, "|'")
      .replace(/\[/, '|[')
      .replace(/\]/, '|]')
      .replace(/\n/g, '|n');
  }

  /**
   * Load the current content in the log file.
   */
  loadLogFile(): Either<Exception, IBuilderMessages> {
    return util
      .readJSON(this.logFile)
      .mapIfLeft(ex => new Exception('failed to load log file', ex)) as Either<
      Exception,
      IBuilderMessages
    >;
  }

  /**
   * Sets the release flag to true in the log file.
   */
  setLogFileReleaseFlag(): Either<Exception, 0> {
    const empty: IBuilderMessages = { errors: [], warnings: [] };
    return evalIteration<Exception, 0>(() => {
      for (const data of this.loadLogFile().fold(
        _ => Right(empty),
        x => Right(x),
      )) {
        data.isRelease = true;
        for (const _ of util.writeJSON(data, this.logFile)) return 0;
      }
    });
  }

  /**
   * To be called before the process finishes so that all the error and warning
   * messages may be dumped.
   */
  dumpMessages(): Either<Exception, 0> {
    const data: IBuilderMessages = {
      errors: [...IO.errors],
      warnings: [...IO.warnings],
    };
    this.loadLogFile().forEach(current => {
      data.errors.push(...current.errors);
      data.warnings.push(...current.warnings);
    });

    if (data.errors.length === 0 && data.warnings.length === 0) {
      // remove file since there is no content?
      return Right(0);
    }

    return util.writeJSON(data, this.logFile);
  }

  /**
   * Prompts the user for the next version provided by the `currentVersion`.
   * The current version is assumed to be parsable by `semver`.
   *
   * @param currentVersion The current version of the package.
   */
  async promptForNewVersion(
    currentVersion: string,
  ): Promise<Either<Exception, string>> {
    const parseVer = (): Option<SemVer> => Maybe(semver.parse(currentVersion));
    const newPatch = parseVer().map(x => x.inc('patch').version);
    const newMinor = parseVer().map(x => x.inc('minor').version);
    const newMajor = parseVer().map(x => x.inc('major').version);

    // releaseSetup needs to be moved to its own script. For now making
    // inquierer being imported here so that node only loads it if when its
    // needed.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const inquirer = require('inquirer');
    const result = await TryAsync(_ =>
      inquirer.prompt([
        {
          type: 'list',
          name: 'version',
          message: `Current version is ${currentVersion}. Choose the next version:`,
          choices: [newPatch, newMinor, newMajor].map(x =>
            x.getOrElse('parse error'),
          ),
        },
      ]),
    );

    return result
      .flatMap(answers => Success((answers as object)['version'] as string))
      .toEither();
  }
}

export { IBuilderMessages, IO };
