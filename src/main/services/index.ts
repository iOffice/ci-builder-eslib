import { BuildUtil } from './BuildUtil';
import { CI, Environment } from './Environment';
import { Git } from './Git';
import { Github } from './Github';
import { IBuilderMessages, IO } from './IO';
import { Yarn } from './Yarn';

class Provider {
  private static instance: Provider;

  readonly env = new Environment();
  readonly io = new IO(this.env);
  readonly git = new Git(this.io);
  readonly github = new Github(this.env, this.io);
  readonly yarn = new Yarn(this.env, this.io);
  readonly buildUtil = new BuildUtil(
    this.env,
    this.io,
    this.git,
    this.github,
    this.yarn,
  );

  private constructor() {}

  static getInstance(): Provider {
    Provider.instance = Provider.instance || new Provider();
    return Provider.instance;
  }
}

export {
  CI,
  Environment,
  IBuilderMessages,
  IO,
  Git,
  Github,
  Provider,
  Yarn,
  BuildUtil,
};
