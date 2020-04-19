import { Either } from '@ioffice/fp';
import { Environment } from './Environment';
import { IO } from './IO';
import { Exception } from '../util';
import { fetch } from './Fetch';

class Github {
  constructor(private env: Environment, private io: IO) {}

  async request(
    endpoint: string,
    method = 'GET',
    body: unknown = null,
  ): Promise<Either<Exception, unknown>> {
    const { owner, repo, githubToken } = this.env;
    const headers = {
      authorization: `Bearer ${githubToken}`,
    };
    return fetch(
      'https',
      'api.github.com',
      `/${owner}/${repo}${endpoint}`,
      {},
      headers,
      method,
      body,
    );
  }

  async createRelease(
    changeLogFile = 'CHANGELOG.md',
    versionPrefix = 'Version ',
  ): Promise<Either<Exception, 0>> {
    const version = this.env.packageVersion;
    const owner = this.env.owner;
    const repo = this.env.repo;
    const result = await this.request('releases', 'POST', {
      // prettier-ignore
      'tag_name': version,
      // prettier-ignore
      'target_commitish': 'master',
      name: `${versionPrefix}${version}`,
      body: `**See [CHANGELOG](https://github.com/${owner}/${repo}/blob/master/${changeLogFile}).**`,
      draft: false,
      prerelease: false,
    });
    return result.fold(
      err =>
        this.io.failure(
          {
            message: 'Failed to release to GitHub',
            data: { version, owner, repo },
          },
          err,
        ),
      _ => this.io.success(0, 'Created Github release'),
    );
  }

  getCompareLink(prev: string, next: string): string {
    const owner = this.env.owner;
    const repo = this.env.repo;
    return `https://github.com/${owner}/${repo}/compare/${prev}...${next}`;
  }
}

export { Github };
