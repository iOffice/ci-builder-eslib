import * as colors from 'colors';

import {
  ExitCode,
  IFileMessages,
  IMessageInfo,
  IProjectResults,
  IProjectStatus,
  ITSMessage,
} from './Types';

/**
 * Insert the `msg` into the given number of spaces either on the left ('l') or
 * the right ('r').
 */
function align(msg: string, alignment: 'l' | 'r', size: number): string {
  const repeatNumber = Math.max(size - msg.length, 0);
  if (alignment === 'l') return msg + ' '.repeat(repeatNumber);
  return ' '.repeat(repeatNumber) + msg;
}

/**
 * Break a string into an array of strings such that each string in the result
 * is at most `size` characters. The break needs to happen so that a split is
 * done at an empty space.
 */
function breakMsg(msg: string, size: number): string[] {
  const result: string[] = [];
  const words: string[] = msg.split(' ');
  const line: string[] = [];
  let length = 0;
  words.forEach((word) => {
    if (length + word.length <= size) {
      line.push(word);
      length += word.length + 1;
    } else {
      result.push(line.join(' '));
      line.splice(0);
      line.push(word);
      length = word.length + 1;
    }
  });
  result.push(line.join(' ').trim());
  return result;
}

function _formatResults(buf: string[], messages: string[][]): void {
  const colSizes: number[] = [0, 0, 0, 0];
  messages.forEach((msg) => {
    msg.forEach((item, index) => {
      if (item.length > colSizes[index]) {
        colSizes[index] = Math.min(item.length, 80);
      }
    });
  });

  const colorMap: { [key: string]: Function } = {
    error: colors.red,
    warning: colors.yellow,
    info: colors.blue,
    log: colors.cyan,
    debug: colors.gray,
  };

  messages.forEach((msg) => {
    const main: string[] = breakMsg(msg[3], colSizes[3]);
    buf.push('  ');
    buf.push(colorMap[msg[0]](align(msg[1], 'r', colSizes[1])));
    buf.push(':');
    buf.push(colorMap[msg[0]](align(msg[2], 'l', colSizes[2])));
    buf.push('  ');
    if (main.length > 1) {
      buf.push(align(main[0], 'l', colSizes[3]));
    } else {
      buf.push(colors.underline(align(main[0], 'l', colSizes[3])));
    }
    buf.push('  ');
    buf.push(colorMap[msg[0]](align(msg[4], 'l', colSizes[4])).dim);
    buf.push('\n');
    if (main.length > 1) {
      const indent = ' '.repeat(5 + colSizes[1] + colSizes[2]);
      main.slice(1).forEach((line, index) => {
        const lineMsg = align(line, 'l', colSizes[3]);
        if (index === main.length - 2) {
          buf.push(`${indent}${lineMsg.underline}`);
        } else {
          buf.push(`${indent}${lineMsg}`);
        }
        buf.push('\n');
      });
    }
  });
}

function formatResults(results: Record<string, IFileMessages>): string {
  const buffer: string[] = [];
  const fileNames: string[] = Object.keys(results).sort();
  fileNames.forEach((fileName) => {
    const obj: IFileMessages = results[fileName];
    const numMessages: number = obj.messages.length;
    if (!numMessages) {
      return;
    }

    const foundMessageWord = `MESSAGE${numMessages === 1 ? '' : 'S'}`;
    const messageInfo = `${numMessages} ${foundMessageWord}`;
    buffer.push(`\n${messageInfo.magenta} in ${fileName.underline.magenta}:\n`);
    buffer.push('\n');

    const messages: string[][] = [];
    obj.messages.forEach((msg: ITSMessage) => {
      messages.push([
        msg.category,
        msg.line.toString(),
        msg.character.toString(),
        msg.message,
        msg.type,
      ]);
    });

    _formatResults(buffer, messages);
  });
  return buffer.join('');
}

function _formatExceptions(
  buf: string[],
  messages: [boolean, string, number, number][],
): void {
  let size = 0;
  messages.forEach((msg) => {
    if (msg[1].length > size) {
      size = msg[1].length;
    }
  });

  messages.forEach((msg) => {
    const failed = msg[0];
    const warn = msg[2] < msg[3];
    buf.push('  ');
    if (warn) {
      buf.push('✗'.yellow);
    } else {
      buf.push(failed ? '✗'.red : '✓'.green);
    }
    buf.push(' ');
    if (failed) {
      buf.push(align(msg[1], 'l', size).red);
    } else if (warn) {
      buf.push(align(msg[1], 'l', size).yellow);
    } else {
      buf.push(align(msg[1], 'l', size).green);
    }
    buf.push(' ');
    if (failed) {
      const allowed =
        msg[3] === -1 ? '' : `, ${msg[3].toString().yellow} allowed`;
      buf.push(`${msg[2].toString().red} found${allowed}\n`);
    } else if (warn) {
      buf.push(
        `${msg[2].toString().green} found, ${
          msg[3].toString().yellow
        } allowed\n`,
      );
    } else {
      buf.push(`${msg[2]} found, ${msg[3]} allowed\n`.gray);
    }
  });
}

function formatCIResults(
  byMessage: Record<string, IMessageInfo>,
  listLimit: number,
): string {
  const buffer: string[] = [];
  const msgTypes: string[] = Object.keys(byMessage).sort();
  msgTypes.forEach((msgType) => {
    const obj = byMessage[msgType];
    const numMessages = obj.count;
    if (!numMessages) {
      return;
    }

    const messageInfo = `${numMessages} ${msgType}`;
    buffer.push(`\n${messageInfo.magenta}:\n`);
    buffer.push('\n');

    const fileNames = obj.references.map((x) => x.fileInfo.absPath);
    const uniqueFileNames = Array.from(new Set(fileNames));

    const totalRefs = Math.min(listLimit, uniqueFileNames.length);
    const refs = uniqueFileNames.slice(0, totalRefs);
    refs.forEach((msg) => {
      const msgReferences = obj.references.filter(
        (x) => x.fileInfo.absPath === msg,
      );
      const locations = msgReferences.map(
        (x) => `${x.message.line.toString().red}:${x.message.character}`,
      );
      buffer.push(`  - ${msg}\n`);
      buffer.push(`    ${locations.join(', ')}\n`);
    });
    if (totalRefs < uniqueFileNames.length) {
      buffer.push('    ...\n');
    }
  });
  return buffer.join('');
}

function formatProjectResults(
  projectStatus: IProjectStatus,
  projectResults: IProjectResults,
  ci: boolean,
  ciLimit: number,
  ciFilesPerMessage: number,
): string {
  const buffer: string[] = [];

  let allMessages = '';
  if (!ci || projectResults.numMessages < ciLimit) {
    allMessages = formatResults(projectResults.results);
  } else {
    allMessages = formatCIResults(projectResults.byMessage, ciFilesPerMessage);
  }

  const allTypes = Array.from(
    new Set([
      ...Object.keys(projectResults.byMessage),
      ...Object.keys(projectStatus.exceptions),
    ]),
  ).sort();

  const messages: [boolean, string, number, number][] = [];
  allTypes.forEach((type) => {
    const exception = projectStatus.exceptions[type];
    if (exception) {
      messages.push([
        exception.failed,
        exception.type,
        exception.found,
        exception.allowed,
      ]);
    } else {
      messages.push([true, type, projectResults.byMessage[type].count, -1]);
    }
  });
  _formatExceptions(buffer, messages);
  const exceptions = messages.length
    ? `${'STATS:'.magenta}\n\n${buffer.join('')}`
    : '';
  buffer.length = 0;

  if (projectStatus.status === ExitCode.NEEDS_READJUSTMENT) {
    return `${exceptions}\n\n`;
  }

  return `${allMessages}\n\n${exceptions}\n\n`;
}

function formatFailureMessage(
  projectStatus: IProjectStatus,
  projectResults: IProjectResults,
  tsconfig: string,
): string {
  if (projectStatus.status === ExitCode.NEEDS_READJUSTMENT) {
    return `Number of allowed messages need to be lowered in \`${tsconfig}\``;
  }

  const formatItem = (itemName: string, itemCount: number): string => {
    const amount = itemCount === 1 ? '' : 's';
    return `\`${itemCount}\` _${itemName}${amount}_`;
  };

  const results = projectResults.results;
  const numFiles = Object.keys(results).filter((fileName) => {
    const obj: IFileMessages = results[fileName];
    return obj.messages.length > 0;
  }).length;

  const errors = projectResults.numErrors;
  const warnings = projectResults.numWarnings;
  const stats: string[] = [];
  if (errors) stats.push(`${formatItem('error', errors)}`);
  if (warnings) stats.push(`${formatItem('warning', warnings)}`);

  return `${stats.join(' and ')} found over the span of ${formatItem(
    'file',
    numFiles,
  )}`;
}

export { formatResults, formatProjectResults, formatFailureMessage };
