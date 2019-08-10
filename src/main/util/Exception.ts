/**
 * An interface to be able to provide two types of messages.
 */
interface IExceptionMessage<T> {
  /**
   * The exception message.
   */
  message: string;

  /**
   * A possible follow up explanation to the message.
   */
  description?: string;

  /**
   * Any data associated to the exception.
   */
  data?: T;
}

/**
 * Inner process communications cannot pass Error nor Exception instances.
 * Instead we can send JSON data. The `IException` interface contains the
 * essence of the exception.
 */
interface IException {
  /**
   * The error message.
   */
  message: string;

  /**
   * The stack trace.
   */
  stackTrace: string[];

  /**
   * A follow up to the error message.
   */
  description?: string;

  /**
   * Any data that may have been attached to the exception.
   */
  data?: unknown;

  /**
   * The cause that triggered the exception.
   */
  cause?: Error | IException;
}

/**
 * Simple version of java's Exception class.
 */
class Exception extends Error implements IException {
  /**
   * A possible follow up explanation to the exception message.
   */
  description?: string;

  /**
   * Any data associated with the exception.
   */
  data?: unknown;

  /**
   * The stacktrace.
   */
  stackTrace: string[];

  /**
   * @param message A string or an IExceptionMessage object.
   * @param cause A possible reason that caused the exception to be thrown.
   */
  constructor(
    message: string | IExceptionMessage<unknown>,
    public cause?: Error | IException,
  ) {
    super(typeof message === 'string' ? message : message.message);
    if (typeof message !== 'string') {
      this.data = message.data;
      this.description = message.description;
    }
    this.stackTrace = Exception.getStackTrace(this);
  }

  /**
   * The serialization of the exception.
   */
  toObject(): IException {
    let cause = this.cause;
    if (this.cause instanceof Exception) {
      cause = this.cause.toObject();
    } else if (this.cause instanceof Error) {
      const errInstance = new Exception(this.cause.message);
      errInstance.stackTrace = Exception.getStackTrace(this.cause);
      cause = errInstance.toObject();
    }

    return {
      message: this.message,
      ...(this.description && { description: this.description }),
      ...(this.data && { data: this.data }),
      ...(this.stackTrace && { stackTrace: this.stackTrace }),
      ...(cause && { cause: cause }),
    };
  }

  /**
   * Returns the stack trace of an error as an array of strings.
   *
   * @param err An Error object.
   */
  static getStackTrace(err: Error): string[] {
    return (err.stack || '').toString().split('\n');
  }
}

export { IExceptionMessage, Exception, IException };
