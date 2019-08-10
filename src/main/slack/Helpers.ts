import { ISlacker } from './CISlack';
import { IProgramExitCode } from '../builders';

/**
 * This is a convenience function to use when creating a script. Note that the
 * Slacker parameter must be an object which extends from `CISlack`.
 */
async function runSlacker(Slacker: ISlacker): Promise<IProgramExitCode> {
  const slack = new Slacker();
  const res = await slack.run();

  return res.fold(_ => ({ code: 1 }), _ => ({ code: 0 }));
}

export { runSlacker };
