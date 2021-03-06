import { IO } from './IO';
import { Exception, util } from '../util';
import {
  Either,
  Maybe,
  asyncEvalIteration,
  Try,
  Success,
  Failure,
} from '@ioffice/fp';
import { StepResult } from '../builders';
import { Environment } from './Environment';

const onData = (data: string): void => {
  process.stdout.write(data.toString());
};

/**
 * Wrapper for commonly used yarn commands.
 */
class Yarn {
  constructor(private env: Environment, private io: IO) {}

  /**
   * Execute the `yarn publish`.
   *
   * @param newVersion The version to publish.
   * @param tag defaults to latest.
   */
  async publish(newVersion: string, tag = 'latest'): Promise<StepResult> {
    this.io.openBlock('yarn-publish', 'publishing');
    const result = await util.execCmd(
      `yarn publish --new-version ${newVersion} --tag ${tag}`,
      onData,
    );
    this.io.closeBlock('yarn-publish');
    return result.fold(
      (_) => this.io.failure('yarn publish failed'),
      (_) => this.io.success(0),
    );
  }

  /**
   * wrapper for `npm whoami`. Uses the registry specified in the package.
   */
  async whoami(): Promise<Either<Exception, string>> {
    const pkg = this.env.package as object;
    const registryEither = Maybe(pkg?.['publishConfig']?.['registry']).toRight(
      new Exception('missing publishConfig.registry in package.json'),
    );
    return asyncEvalIteration<Exception, string>(async () => {
      for (const registry of registryEither)
        for (const val of (
          await util.exec(`npm whoami --registry ${registry}`)
        ).mapIfLeft(
          (err) => new Exception({ message: 'npm whoami failure', data: err }),
        ))
          return val.trim();
    });
  }

  /**
   * Fetches the package version from the registry specified in the package.
   */
  async getVersion(): Promise<Either<Exception, string>> {
    const name = this.env.packageName;
    return (await util.exec(`yarn info ${name} version --json`)).fold(
      (err) =>
        this.io.failure<string>({
          message: 'failure to obtain package version from registry',
          data: Try(() => JSON.parse(err)).getOrElse(err),
        }),
      async (res) =>
        Try(() => JSON.parse(res))
          .transform(
            (obj) => Success(obj['data'] as string),
            (parseError) =>
              Failure(
                new Exception({
                  message: 'failed to parse yarn response',
                  data: { parseError, res },
                }),
              ),
          )
          .toEither<Exception>(),
    );
  }
}

export { Yarn };
