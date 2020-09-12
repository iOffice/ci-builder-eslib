import * as Mocha from 'mocha';

/**
 * Making sure the builder works before we use it in the project.
 */
const test = (): Promise<string> => {
  return new Promise<string>((fulfill) => {
    const mocha = new Mocha();
    mocha.useColors(true);
    mocha.addFile('build/test/builder/index.js');
    mocha.run((failures) => {
      if (failures > 0) {
        const verb = failures === 1 ? 'is' : 'are';
        const amount = failures === 1 ? '' : 's';
        fulfill(`There ${verb} ${failures} test${amount} failing`);
      } else {
        fulfill('');
      }
    });
  });
};

const main = async (): Promise<void> => {
  const msg = await test();
  if (msg) console.error(msg);

  process.on('exit', () => {
    process.exit(msg === '' ? 0 : 1);
  });
};

main();
