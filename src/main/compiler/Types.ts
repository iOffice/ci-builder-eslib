type MessageCategory = 'error' | 'warning' | 'info' | 'log' | 'debug';

enum ExitCode {
  OK,
  WARNING,
  ERROR,
  WARNING_EXCEPTION,
  ERROR_EXCEPTION,
  NODE_ERROR,
  NEEDS_READJUSTMENT,
}

interface ITSMessage {
  message: string;
  line: number;
  character: number;
  width: number;
  issuer: string;
  category: MessageCategory;
  type: string;
}

interface IFileInfo {
  fileName: string;
  absPath: string;
  outDirectory: string;
}

interface IFileMessages extends IFileInfo {
  messages: ITSMessage[];
}

interface IMessageReference {
  message: ITSMessage;
  fileInfo: IFileInfo;
}

interface IMessageInfo {
  count: number;
  references: IMessageReference[];
}

interface IProjectResults {
  numMessages: number;
  numErrors: number;
  numWarnings: number;
  results: Record<string, IFileMessages>;
  byMessage: Record<string, IMessageInfo>;
}

interface IProjectStatus {
  status: ExitCode;
  exceptions: Record<
    string,
    {
      type: string;
      found: number;
      allowed: number;
      failed: boolean;
    }
  >;
}

export {
  MessageCategory,
  ExitCode,
  ITSMessage,
  IFileInfo,
  IFileMessages,
  IMessageInfo,
  IMessageReference,
  IProjectResults,
  IProjectStatus,
};
