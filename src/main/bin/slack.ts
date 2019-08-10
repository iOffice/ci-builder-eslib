#!/usr/bin/env node
import { runSlacker, TravisSlack } from '../slack';

async function main(): Promise<void> {
  const { code } = await runSlacker(TravisSlack);

  process.on('exit', () => {
    process.exit(code);
  });
}

main();
