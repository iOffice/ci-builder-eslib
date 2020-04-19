import { exec as cpExec, spawn } from 'child_process';
import {
  mkdirSync,
  readdirSync,
  renameSync,
  rmdirSync,
  statSync,
  writeFileSync,
  readFileSync,
} from 'fs';
import * as pth from 'path';
import * as semver from 'semver';
import { SemVer } from 'semver';

import {
  Either,
  Right,
  Success,
  Try,
  Failure,
  Left,
  Maybe,
  evalIteration,
} from '@ioffice/fp';
import { Exception } from './Exception';
import { IParsedArgV, IArgV } from './Types';

/**
 * Shortcut to transform an error to exception.
 */
const toFailure = <T>(msg: string, err: Error, data?: unknown): Try<T> => {
  return Failure(new Exception({ message: msg, data }, err));
};

/**
 * Overrides the write definitions of `process.stdout` and `process.stderr` so
 * that we may modify the text before it is written. This function will return
 * a function that will restore the original definitions when called.
 *
 * @param streamInterceptor A function to handle the content. It must return
 *  a new string to be written. If none is desired provide `''`.
 */
const interceptWriteStreams = (
  streamInterceptor: (txt: string) => string,
): (() => void) => {
  const stdoutWrite = process.stdout.write;
  const stderrWrite = process.stderr.write;

  const overwrite = (
    stream: NodeJS.WriteStream,
    write: Function,
  ): ((...args: unknown[]) => boolean) => (...args: unknown[]) => {
    const str = args[0] as string;
    const result = streamInterceptor(str);
    const end = result && /\n$/.test(str) ? '\n' : '';
    args[0] = `${result.replace(/\n$/, '')}${end}`;
    return write.apply(stream, args);
  };

  process.stdout.write = overwrite(process.stdout, process.stdout.write);
  process.stderr.write = overwrite(process.stderr, process.stderr.write);

  return () => {
    process.stdout.write = stdoutWrite;
    process.stderr.write = stderrWrite;
  };
};

/**
 * Recursive helper function to move files from one directory to another.
 * @private
 */
const _move = (src: string, dest: string, buf: string[]): void => {
  const stats = statSync(src);
  if (stats.isFile()) {
    buf.push(pth.normalize(dest));
    renameSync(src, pth.normalize(dest));
  } else if (stats.isDirectory()) {
    if (src.endsWith('/')) {
      // move directory contents
      const files = readdirSync(src);
      files.forEach(file => {
        const filePath = pth.normalize(`${src}/${file}`);
        const destPath = pth.normalize(`${dest}/${file}`);
        const fileStats = statSync(filePath);
        if (fileStats.isFile()) {
          buf.push(destPath);
          renameSync(filePath, destPath);
        } else if (fileStats.isDirectory()) {
          try {
            mkdirSync(destPath);
          } catch (e) {}
          _move(`${filePath}/`, destPath, buf);
          rmdirSync(filePath);
        }
      });
    } else {
      // move whole directory
      const dirName = pth.basename(src);
      try {
        mkdirSync(pth.normalize(`${dest}/${dirName}`));
      } catch (e) {}
      _move(`${src}/`, pth.normalize(`${dest}/${dirName}`), buf);
      rmdirSync(src);
    }
  }
};

const util = {
  /**
   * Execute a system command such as `pwd`. When setting the `print` argument
   * to true the promise will return an empty string and all the output from the
   * command will be redirected to the current stdout stream. You will still
   * need to handle a Left or Right empty value.
   *
   * NOTE: This function only supports one command at a time. Use `exec` for any
   * combination of commands.
   */
  execCmd(
    cmd: string,
    print?: (data: string) => void,
  ): Promise<Either<string, string>> {
    return new Promise<Either<string, string>>(fulfill => {
      const parts = cmd.split(' ');
      const handle = spawn(parts[0], parts.slice(1));
      const buffer: string[] = [];
      const onData = print || ((data: string) => buffer.push(data.toString()));
      handle.stdout.on('data', onData);
      handle.stderr.on('data', onData);
      handle.on('exit', code => {
        if (code === 0) {
          fulfill(Right(buffer.join('').trim()));
        } else {
          fulfill(Left(buffer.join('').trim()));
        }
      });
    });
  },

  /**
   * Execute a system command such as `pwd`. Note that some output may be
   * missing since some programs print to stderr and we are only resolving the
   * output of stdout.
   */
  exec(cmd: string): Promise<Either<string, string>> {
    return new Promise<Either<string, string>>(fulfill => {
      cpExec(cmd, (error, stdout, stderr) => {
        if (error) {
          return fulfill(Left(error.toString()));
        }
        if (stderr && !stdout) {
          return fulfill(Left(stderr.toString()));
        }
        fulfill(Right(stdout.toString().trim()));
      });
    });
  },

  /**
   * Read the contents from a file. Returns either an exception or the contents
   * of the file.
   */
  readFile(name: string, path?: string): Either<Exception, string> {
    const base: string = path || process.cwd();
    return Try(() => readFileSync(`${base}/${name}`, 'utf8'))
      .transform(
        _ => Success(_),
        err => toFailure('failed to read file', err, { name, path }),
      )
      .toEither();
  },

  /**
   * Returns either an exception or the parsed JSON contents of the file.
   */
  readJSON(name: string, path?: string): Either<Exception, unknown> {
    return evalIteration(() => {
      for (const contents of util.readFile(name, path))
        for (const obj of Try(() => JSON.parse(contents))
          .transform(
            _ => Success(_),
            err => toFailure('failed to parse JSON file', err, { name, path }),
          )
          .toEither())
          return obj;
    });
  },

  /**
   * Write the contents to a file.
   */
  writeFile(
    contents: string,
    name: string,
    path?: string,
  ): Either<Exception, 0> {
    const base: string = path || process.cwd();
    return Try(_ => writeFileSync(`${base}/${name}`, contents))
      .transform(
        _ => Success(0 as 0),
        err => toFailure('failed to write file', err, { name, path }),
      )
      .toEither();
  },

  /**
   * Write the contents to a file. Returns a boolean indicating if writing was
   * successful.
   */
  writeJSON(
    contents: unknown,
    name: string,
    path?: string,
  ): Either<Exception, 0> {
    const strContent = Try(() => JSON.stringify(contents, null, 2))
      .transform(
        _ => Success(_),
        err => toFailure('failed to stringify contents', err),
      )
      .toEither() as Either<Exception, string>;
    return evalIteration<Exception, 0>(() => {
      for (const strContents of strContent)
        for (const _ of util.writeFile(strContents, name, path)) return 0;
    });
  },

  /**
   * Update the version property in the file `package.json`. The second
   * parameter can be used to specify the location to the file.
   */
  changePackageVersion(
    version: string,
    filePath = './package.json',
  ): Either<Exception, 0> {
    const update = (contents: string): Either<Exception, string> => {
      const lines = contents.split('\n');
      return Right(
        lines
          .map(line =>
            line.trim().startsWith('"version"')
              ? `  "version": "${version}",`
              : line,
          )
          .join('\n'),
      ) as Either<Exception, string>;
    };
    return evalIteration<Exception, 0>(() => {
      for (const contents of util.readFile(filePath))
        for (const newContent of update(contents))
          for (const _ of util.writeFile(newContent, filePath)) return 0;
    });
  },

  /**
   * Move files and/or directories recursively. If the `src` parameter ends with
   * `/` then only the contents of the directory will be moved to the
   * destination. Otherwise the whole `src` directory will be moved to the
   * destination.
   */
  move(src: string, dest: string): Either<Exception, string[]> {
    const buf: string[] = [];
    return Try(() => _move(src, dest, buf))
      .transform(
        _ => Success(buf),
        err => toFailure('Failure to move directories', err, { src, dest }),
      )
      .toEither();
  },

  /**
   * Helpful in command line applications to parse the argument vector provided
   * to the cli.
   *
   * @param argv process.argv
   * @param config
   */
  parseArgVector(
    argv: string[],
    config: IArgV,
  ): Either<Exception, IParsedArgV> {
    const result: IParsedArgV = {
      booleans: {},
      definitions: { ...config.definitions },
    };
    for (const item of argv) {
      if (config.booleans[item]) {
        result.booleans[config.booleans[item]] = true;
      } else if (item.startsWith('-D')) {
        const [name, value] = item.split('=');
        const defName = name.slice(2);
        if (!(defName in result.definitions)) {
          return Left(new Exception(`${defName} is not a valid -D argument`));
        }
        result.definitions[defName] = value;
      } else {
        return Left(new Exception(`${item} is not a valid argument`));
      }
    }

    return Right(result);
  },

  /**
   * Get a SemVer object from a version string as an Either.
   * @param version The version to transform.
   */
  toSemVer(version: string): Either<Exception, SemVer> {
    return Maybe(semver.parse(version)).toRight(
      new Exception({ message: 'failed to parse version', data: { version } }),
    );
  },
};

export { util, interceptWriteStreams };
