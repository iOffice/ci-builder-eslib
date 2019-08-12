import * as http from 'request-promise-native';

import { Environment } from './Environment';
import { IO } from './IO';
import { Exception } from '../util';
import { Either, TryAsync } from '@ioffice/fp';

class Github {
  readonly baseUrl: string;

  constructor(private env: Environment, private io: IO) {
    this.baseUrl = `https://api.github.com/repos/${env.owner}/${env.repo}`;
  }

  async request(
    endpoint: string,
    method: string = 'GET',
    body: unknown = null,
  ): Promise<Either<Exception, unknown>> {
    const options = {
      method,
      uri: `${this.baseUrl}/${endpoint}`,
      // prettier-ignore
      qs: { 'access_token': this.env.githubToken },
      headers: { 'User-Agent': 'iOffice-TCBuilder' },
      json: true,
    };
    if (body) {
      options['body'] = body;
    }

    return (await TryAsync(_ => http(options).promise())).toEither();
  }

  async createRelease(
    changeLogFile: string = 'CHANGELOG.md',
    versionPrefix: string = 'Version ',
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
