import { CISlack } from './CISlack';

class TravisSlack extends CISlack {
  getTitle(): string {
    const { repo, buildNumber } = this.env;
    const buildType = this.getBuildType()
      .map(x => ` ${x}`)
      .getOrElse('');
    return `${repo} [Travis${buildType} Build #${buildNumber}]`;
  }

  getTitleLink(): string {
    const { owner, repo, buildId } = this.env;
    return `https://travis-ci.com/${owner}/${repo}/builds/${buildId}`;
  }
}

export { TravisSlack };
