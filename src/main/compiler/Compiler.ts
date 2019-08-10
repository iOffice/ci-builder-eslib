import * as fs from 'fs';
import * as pth from 'path';
import * as ts from 'typescript';
import { CLIEngine, Linter } from 'eslint';

import { Provider } from '../services';
import { formatProjectResults, formatFailureMessage } from './Formatter';
import {
  ExitCode,
  IFileMessages,
  IMessageInfo,
  IProjectResults,
  IProjectStatus,
  ITSMessage,
  MessageCategory,
} from './Types';
import { ifElseChain, Maybe, None, Option } from '../fp';
import { Exception, ICompileConfig } from '../util';

function getDiagnosticCategory(
  category: ts.DiagnosticCategory,
): MessageCategory {
  const map: Record<number, MessageCategory> = {
    [ts.DiagnosticCategory.Error]: 'error',
    [ts.DiagnosticCategory.Warning]: 'warning',
    [ts.DiagnosticCategory.Message]: 'warning',
  };
  return map[category];
}

function compile(
  program: ts.Program,
  tsOptions: ts.CompilerOptions,
  esLintConfigPath: Option<string>,
): Record<string, IFileMessages> {
  const results: Record<string, IFileMessages> = {};
  const outDirectory: string = tsOptions.outDir || '.';
  const emitResult: ts.EmitResult = program.emit();
  const preDiagnostics = ts.getPreEmitDiagnostics(program);
  const allDiagnostics: ts.Diagnostic[] = preDiagnostics.concat(
    emitResult.diagnostics,
  );
  const emittedFiles: ts.SourceFile[] = program
    .getSourceFiles()
    .filter(x => !x.fileName.includes('node_modules'));

  const eslintResults = esLintConfigPath.map(configFile => {
    const cli = new CLIEngine({
      useEslintrc: false,
      configFile,
    });
    return cli.executeOnFiles(
      emittedFiles.filter(x => x && x.fileName).map(x => x.fileName),
    );
  });

  const lintFailuresByFile: Record<string, Linter.LintMessage[]> = {};
  eslintResults.forEach(eslintResult => {
    eslintResult.results.forEach(entry => {
      lintFailuresByFile[entry.filePath] = entry.messages;
    });
  });

  emittedFiles.forEach(file => {
    if (!file || !file.fileName) {
      return;
    }

    const fileName: string = file.fileName;
    if (!results[fileName]) {
      results[fileName] = {
        fileName,
        outDirectory,
        absPath: pth.resolve(file.fileName),
        messages: [],
      };
    }

    Maybe(lintFailuresByFile[fileName]).forEach(failures => {
      const fileMessages: IFileMessages = results[fileName];
      failures.forEach(failure => {
        fileMessages.messages.push({
          message: failure.message,
          line: failure.line,
          character: failure.column,
          width: 0,
          issuer: 'eslint',
          category: 'warning',
          type: failure.ruleId || 'unknown',
        });
      });
      fileMessages.messages.sort((a, b) => a.line - b.line);
    });
  });

  allDiagnostics.forEach(diagnostic => {
    const file = diagnostic.file;
    if (!file || !file.fileName || !diagnostic.start) {
      return;
    }
    const fileMessages: IFileMessages = results[file.fileName];
    const pos: ts.LineAndCharacter = file.getLineAndCharacterOfPosition(
      diagnostic.start,
    );
    const message: string = ts.flattenDiagnosticMessageText(
      diagnostic.messageText,
      '',
    );
    if (fileMessages) {
      fileMessages.messages.push({
        message,
        line: pos.line + 1,
        character: pos.character + 1,
        width: 0,
        issuer: 'typescript',
        category: getDiagnosticCategory(diagnostic.category),
        type: `TS${diagnostic.code}`,
      });
      fileMessages.messages.sort((a, b) => a.line - b.line);
    }
  });

  return results;
}

function compileProject(
  tsConfigPath: string,
  esLintConfigPath: Option<string> = None,
): IProjectResults {
  const project = ts.readConfigFile(tsConfigPath, ts.sys.readFile);
  if (project.error) {
    throw new Error(
      ts.formatDiagnostics([project.error], {
        getCanonicalFileName: f => f,
        getCurrentDirectory: process.cwd,
        getNewLine: () => '\n',
      }),
    );
  }
  const parseConfigHost: ts.ParseConfigHost = {
    fileExists: fs.existsSync,
    readDirectory: ts.sys.readDirectory,
    readFile: file => fs.readFileSync(file, 'utf8'),
    useCaseSensitiveFileNames: true,
  };
  const parsed = ts.parseJsonConfigFileContent(
    project.config,
    parseConfigHost,
    pth.resolve(process.cwd()),
    {}, // noEmit: true
  );
  if (parsed.errors !== undefined) {
    // ignore warnings and 'TS18003: No inputs were found in config file ...'
    const errors = parsed.errors.filter(
      d => d.category === ts.DiagnosticCategory.Error && d.code !== 18003,
    );
    if (errors.length !== 0) {
      throw new Error(
        ts.formatDiagnostics(errors, {
          getCanonicalFileName: f => f,
          getCurrentDirectory: process.cwd,
          getNewLine: () => '\n',
        }),
      );
    }
  }

  // TODO: https://github.com/microsoft/TypeScript/pull/31432
  const host = ts.createCompilerHost(parsed.options, true);
  const program = ts.createProgram(parsed.fileNames, parsed.options, host);
  const results = compile(
    program,
    project.config.compilerOptions || {},
    esLintConfigPath,
  );
  const output: IProjectResults = {
    results,
    numMessages: 0,
    numErrors: 0,
    numWarnings: 0,
    byMessage: {},
  };
  Object.keys(results).forEach((key: string) => {
    const file = results[key];
    output.numMessages += file.messages.length;
    file.messages.forEach((msg: ITSMessage) => {
      const item = (output.byMessage[msg.type] = output.byMessage[msg.type] || {
        count: 0,
        references: [],
      });
      item.count += 1;
      item.references.push({
        message: msg,
        fileInfo: file,
      });
      if (msg.category === 'error') {
        output.numErrors += 1;
      } else if (msg.category === 'warning') {
        output.numWarnings += 1;
      }
    });
  });
  return output;
}

/**
 * Process the project results along with the message map containing the allowed
 * number of messages to determine an exit code.
 */
function getProjectStatus(
  projectResults: IProjectResults,
  messageMap: Record<string, number>,
): IProjectStatus {
  const exceptionsResults: IProjectStatus = {
    status: ExitCode.OK,
    exceptions: {},
  };
  const messageTypes = Object.keys(messageMap);
  const failureStatus = {
    needsReadjustment: false,
    errorException: false,
    warningException: false,
    errorCounter: projectResults.numErrors,
    warningCounter: projectResults.numWarnings,
  };

  messageTypes.forEach(type => {
    const message: IMessageInfo = projectResults.byMessage[type] || {
      count: 0,
      references: [],
    };
    const sample = message.references[0];

    const failed = message.count > messageMap[type];
    const needsReadjustment = message.count < messageMap[type];
    failureStatus.needsReadjustment =
      failureStatus.needsReadjustment || needsReadjustment;
    if (!sample) {
      // There are no errors for this type ...
    } else if (sample.message.category === 'error') {
      failureStatus.errorCounter -= message.count;
      failureStatus.errorException = failureStatus.errorException || failed;
    } else {
      failureStatus.warningCounter -= message.count;
      failureStatus.warningException = failureStatus.warningException || failed;
    }

    exceptionsResults.exceptions[type] = {
      type,
      failed,
      found: message.count,
      allowed: messageMap[type],
    };
  });

  exceptionsResults.status = ifElseChain(
    [failureStatus.errorException, _ => ExitCode.ERROR_EXCEPTION],
    [failureStatus.warningException, _ => ExitCode.WARNING_EXCEPTION],
    [failureStatus.errorCounter > 0, _ => ExitCode.ERROR],
    [failureStatus.warningCounter > 0, _ => ExitCode.WARNING],
    [failureStatus.needsReadjustment, _ => ExitCode.NEEDS_READJUSTMENT],
  ).getOrElse(_ => ExitCode.OK);

  return exceptionsResults;
}

/**
 * Utility function to compile a project and decide if a build should fail based
 * on the number of errors/warnings found in the files.
 *
 * @param config: The configuration for the compilation.
 */
function compileCLI(config: ICompileConfig): ExitCode {
  const tsconfigPath = config.tsconfigPath;
  const eslintPath = Maybe(config.eslintPath).filter(x => x !== '');
  const dumpMessages = Maybe(config.dumpMessages).getOrElse(true);
  const messageMap = Maybe(config.messageMap).getOrElse({});
  const ci = Maybe(config.ci).getOrElse(false);
  const ciLimit = Maybe(config.ciLimit).getOrElse(10);
  const ciFilesPerMessage = Maybe(config.ciFilesPerMessage).getOrElse(5);

  const io = Provider.getInstance().io;
  let projectResults: IProjectResults;
  try {
    projectResults = compileProject(tsconfigPath, eslintPath);
  } catch (e) {
    io.error(
      new Exception(`Failure during project compilation: ${e.message}`, e),
    );
    if (dumpMessages) {
      io.dumpMessages();
    }
    return ExitCode.NODE_ERROR;
  }

  const projectStatus = getProjectStatus(projectResults, messageMap);
  if (projectStatus.status !== ExitCode.OK) {
    io.log(
      formatProjectResults(
        projectStatus,
        projectResults,
        ci,
        ciLimit,
        ciFilesPerMessage,
      ),
    );
    io.error(
      new Exception(formatFailureMessage(projectStatus, projectResults)),
    );
    if (dumpMessages) {
      io.dumpMessages();
    }
  }
  return projectStatus.status;
}

export { compile, compileProject, getProjectStatus, compileCLI };
