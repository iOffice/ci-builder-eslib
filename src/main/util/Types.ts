/**
 * Used to define all the expected arguments from the command line.
 */
interface IArgV {
  /**
   * This property defines the names of all the boolean parameters expected
   * in the command line. For instance
   *
   * ```
   * {
   *   booleans: {
   *     '--no-lint': 'noLint',
   *   }
   * }
   * ```
   *
   * This states that if `--no-lint` is defined in the command line then a
   * boolean will be stored in the variable `noLint`.
   */
  booleans: Record<string, string>;

  /**
   * This property is used to define variables that may appear in the command
   * line.
   *
   * ```
   * {
   *   definitions: {
   *     tsConfigPath: 'defaultValue',
   *   }
   * }
   * ```
   *
   * This states that if `-DtsConfigPath=newValue` is defined then `newValue`
   * will be assigned to `tsConfigPath`.
   */
  definitions: Record<string, string>;
}

/**
 * Similar to IArgV, but each of the properties are mapped to either
 * boolean or string.
 */
interface IParsedArgV {
  /**
   * See `IArgV.booleans`.
   */
  booleans: Record<string, boolean>;

  /**
   * See `IArgV.definitions`.
   */
  definitions: Record<string, string>;
}

/**
 * The configuration object for the compileCLI.
 */
interface ICompileConfig {
  /**
   * Path to the typescript configuration file.
   */
  tsconfigPath: string;

  /**
   * Path to the eslint configuration file.
   */
  eslintPath?: string;

  /**
   * Specifies the messages that can be ignored, a.k.a Please allow some
   * error/warning messages por favor.
   */
  messageMap?: Record<string, number>;

  /**
   * Continuous integration flag.
   */
  ci?: boolean;

  /**
   * A threshold to determine if CI Mode should be engaged. For instance,
   * if this value is 10 (default) then all messages will be printed as if
   * no ci flag is enabled.
   */
  ciLimit?: number;

  /**
   * If errors are being formatted in CI mode then this number determines
   * the number maximum number of files to display per message.
   */
  ciFilesPerMessage?: number;

  /**
   * If `true`, a summary of all the messages will be stored in a file.
   */
  dumpMessages?: boolean;
}

export { IArgV, IParsedArgV, ICompileConfig };
