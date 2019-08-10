import * as http from 'request-promise-native';

import { IBuilderMessages, Provider } from '../services';
import { IAction, IField, IAttachment } from './Types';
import { StepResult } from '../builders';
import { Exception } from '../util';
import { Either, Option, TryAsync } from '../fp';

/**
 * Service to send slack messages. For this to work there needs to be
 * environment variables with keys of the form of `SLACK_CHANNEL_<id>` and
 * values of form `<token>#<channel>`. Here `<id>` can be anything to help you
 * identify the token.
 */
abstract class CISlack {
  readonly env = Provider.getInstance().env;
  readonly io = Provider.getInstance().io;
  readonly messages: IBuilderMessages;
  readonly error: Option<Exception>;
  readonly isRelease: boolean;

  constructor() {
    const logFile = this.io.loadLogFile();
    const logs = logFile.getOrElse({
      isRelease: false,
      errors: [],
      warnings: [],
    });
    this.messages = logs;
    this.isRelease = logs.isRelease;
    this.error = logFile.swap().toOption();
  }

  abstract getTitle(): string;

  abstract getTitleLink(): string;

  async run(): Promise<StepResult> {
    if (this.env.slackChannels.length === 0) {
      return this.io.warn(new Exception('no slack channels found'));
    }

    const attachment = this.createAttachment();
    const promises = this.env.slackChannels.map(item => {
      const [token, channel] = item.split('#');
      this.io.log(`sending message to channel: '${channel}'`);
      return this.sendMessage(token, channel, attachment);
    });

    await Promise.all(promises);
    return this.io.success(0);
  }

  getStatus(): 'good' | 'warning' | 'danger' {
    if (!this.messages) return 'good';
    if (this.messages.errors.length > 0) return 'danger';
    if (this.messages.warnings.length > 0) return 'warning';
    return 'good';
  }

  getBuildType(): string {
    if (this.env.pullRequestBranch) return 'Pull Request';
    if (this.isRelease) return 'Release';
    return `${this.env.targetBranch} Branch`;
  }

  getBuildBranch(): string {
    return this.env.pullRequestBranch || 'master';
  }

  getStatusMessage(status: 'good' | 'warning' | 'danger'): string {
    if (status === 'good') return 'passed with flying colors!';
    if (status === 'warning') return 'passed, but check the logs.';
    return 'failed.';
  }

  getFields(): IField[] {
    const fields: IField[] = [];
    if (this.messages) {
      const listMessages = (item: [string, number][]): string => {
        item.sort((a, b) => a[1] - b[1]);
        return item.map(([msg]) => `• ${msg}`).join('\n');
      };
      if (this.messages.errors.length > 0) {
        fields.push({
          title: 'Problems',
          value: listMessages(this.messages.errors),
          short: false,
        });
      }
      if (this.messages.warnings.length > 0) {
        fields.push({
          title: 'Warnings',
          value: listMessages(this.messages.warnings),
          short: false,
        });
      }
    }

    return fields;
  }

  getActions(): IAction[] {
    const env = this.env;
    if (env.pullRequestBranch) {
      const num = env.pullRequestNumber;
      return [
        {
          type: 'button',
          text: `PR #${num}`,
          url: `https://github.com/${env.owner}/${env.repo}/pull/${num}`,
        },
      ];
    }
    if (this.isRelease) {
      return [
        {
          type: 'button',
          text: `${env.packageName}@${env.packageVersion}`,
          url: `https://github.com/${env.owner}/${env.repo}/releases/tag/${env.packageVersion}`,
        },
      ];
    }
    return [
      {
        type: 'button',
        text: 'Github',
        url: `https://github.com/${env.owner}/${env.repo}`,
      },
    ];
  }

  protected createAttachment(): Partial<IAttachment> {
    const env = this.env;
    const status = this.getStatus();
    const statusMessage = this.getStatusMessage(status);
    const buildType = this.getBuildType();
    const buildBranch = this.getBuildBranch();
    return {
      fallback: `${status}: ${env.repo}/${buildBranch} build ${statusMessage}`,
      color: status,
      title: this.getTitle(),
      // prettier-ignore
      'title_link': this.getTitleLink(),
      text: `The _${buildType}_ build for the *${buildBranch}* branch ${statusMessage}`,
      fields: this.getFields(),
      actions: this.getActions(),
    };
  }

  private async sendMessage(
    token: string,
    channel: string,
    attachment: Partial<IAttachment>,
  ): Promise<Either<Exception, unknown>> {
    const body = {
      channel,
      attachments: [attachment],
      // prettier-ignore
      'as_user': true
    };
    const options = {
      method: 'POST',
      uri: 'https://slack.com/api/chat.postMessage',
      headers: {
        'User-Agent': 'iOFFICE-CIBuilder',
        'Content-Type': 'application/json; charset=utf-8',
        Authorization: `Bearer ${token}`,
      },
      json: true,
      body,
    };
    return (await TryAsync(_ => http(options).promise())).toEither();
  }
}

interface ISlacker {
  new (): CISlack;
}

export { IField, IAction, IAttachment, CISlack, ISlacker };
