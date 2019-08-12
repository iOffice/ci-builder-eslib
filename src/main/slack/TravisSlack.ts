import { CISlack } from './CISlack';
import { Maybe } from '@ioffice/fp';

class TravisSlack extends CISlack {
  getTitle(): string {
    const { repo, buildNumber } = this.env;
    const buildType = this.getBuildType()
      .map(x => ` ${x}`)
      .getOrElse('');
    const nodeVersion = Maybe(process.env['TRAVIS_NODE_VERSION'])
      .map(ver => ` - Node ${ver}`)
      .getOrElse('');
    return `${repo} [Travis${buildType} Build #${buildNumber}${nodeVersion}]`;
  }

  getTitleLink(): string {
    const { owner, repo, buildId } = this.env;
    return `https://travis-ci.com/${owner}/${repo}/builds/${buildId}`;
  }
}

export { TravisSlack };
