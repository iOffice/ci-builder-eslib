import { IBuilder } from './CIBuilder';
import { IProgramExitCode } from './Types';
import { Exception } from '../util';

/**
 * Convenience function to use when creating a script. Note that the
 * builder parameter must be an object which extends from `CIBuilder`.
 */
async function runBuilder(
  Builder: IBuilder,
  dumpMessages: boolean = true,
): Promise<IProgramExitCode> {
  const builder = new Builder();
  builder.io.enableLocalBlocks();
  const res = await builder.run();

  return res.fold(
    err => {
      const msg = err.message;
      const steps = builder.failureSteps.join(' -> ');
      builder.io.error(new Exception(`Failures in \`${steps}\`: ${msg}`, err));
      if (dumpMessages) {
        builder.io.dumpMessages();
      }
      builder.io.disableLocalBlocks();
      return { code: 1 };
    },
    _ => {
      if (dumpMessages) {
        builder.io
          .dumpMessages()
          .swap()
          .forEach(err => {
            builder.io.log(`Unable to dump messages: ${err}`);
          });
      }
      builder.io.log('Process is done.');
      builder.io.disableLocalBlocks();
      return { code: 0 };
    },
  );
}

export { runBuilder };
