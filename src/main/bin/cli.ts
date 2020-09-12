#!/usr/bin/env node
import { compileCLI } from '../compiler';
import { IParsedArgV, Exception, util } from '../util';
import { Maybe } from '@ioffice/fp';

type Unknown = Record<string, unknown>;

let exitNumber = 0;

const log = (msg: string): boolean => process.stdout.write(`${msg}\n`);

const error = (err: Exception): void => {
  exitNumber = 1;
  const msg = JSON.stringify(err.toObject(), null, 2);
  process.stdout.write(`${msg}\n`);
};

const usage = `usage: ioffice-tsc [--options]

iOFFICE typescript/eslint checker

Looks at the 'tsconfig.json' file to compile the project. By default it will
also lint the files unless the '--no-lint' option is present.

Options:

 --help, -h: Print this message.
 --version, -v: Print the version.
 --verbose: Print messages of the steps for the 'compile' command.
 --ci: Continuous Integration flag, minimizes the output in case there are too
       many errors.
 --no-msg-dump: Skip dumping error and warning messages to
                './ciBuilder-log.json'.
 --no-lint: Skip linting.

Inputs:

  -DtsconfigPath: defaults to './tsconfig.json'
  -DeslintPath: defaults to './.eslintrc.json'
  -DciLimit: defaults to '10',
  -DciFilesPerMessage: defaults to '5'

To change an input enter "-DinputName=newValue". For instance "-DciLimit=5".
`;

const main = async (): Promise<void> => {
  const args = {
    commands: {},
    booleans: {
      '--help': 'help',
      '-h': 'help',
      '--version': 'version',
      '-v': 'version',
      '--ci': 'ci',
      '--no-msg-dump': 'noMsgDump',
      '--no-lint': 'noLint',
    },
    definitions: {
      tsconfigPath: './tsconfig.json',
      eslintPath: './.eslintrc.json',
      ciLimit: '10',
      ciFilesPerMessage: '5',
    },
  };
  const startIndex = process.argv[0] === 'ioffice-tsc' ? 1 : 2;
  const parsedArgs = util.parseArgVector(process.argv.slice(startIndex), args);
  const ciPkg = util.readJSON('../package.json', __dirname);

  if (ciPkg.isLeft) return error(ciPkg.value as Exception);
  if (parsedArgs.isLeft) return error(parsedArgs.value as Exception);

  const {
    noLint,
    help,
    version,
    ci,
    noMsgDump,
  } = (parsedArgs.value as IParsedArgV).booleans;

  if (help) {
    log(usage);
  } else if (version) {
    ciPkg.forEach((pkg: Unknown) => {
      log(pkg['version'] as string);
    });
  } else {
    const definitions = (parsedArgs.value as IParsedArgV).definitions;
    util.readJSON(definitions['tsconfigPath'], '.').fold(
      (err) => error(err),
      (config: Unknown) => {
        const builderOptions = (config['ciBuilder'] || {}) as Unknown;
        const messageMap = (builderOptions['allowed'] || {}) as Record<
          string,
          number
        >;
        const maxFiles = Maybe(definitions['ciFilesPerMessage']);
        exitNumber = compileCLI({
          messageMap,
          ci,
          tsconfigPath: definitions['tsconfigPath'],
          eslintPath: noLint ? undefined : definitions['eslintPath'],
          dumpMessages: !noMsgDump,
          ciLimit: Maybe(definitions['ciLimit']).fold(10, (x) => +x),
          ciFilesPerMessage: maxFiles.fold(5, (x) => +x),
        });
      },
    );
  }
};

main();

process.on('exit', () => {
  process.exit(exitNumber);
});
