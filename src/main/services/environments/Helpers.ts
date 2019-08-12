import { Option, Maybe } from '@ioffice/fp';

/**
 * Main package information.
 */
interface IPackageInfo {
  /**
   * The "name" field found in the `package.json`.
   */
  name: string;

  /**
   * The "version" field found in the `package.json`.
   */
  version: string;

  /**
   * The owner of the git repository.
   */
  owner: string;

  /**
   * The git repository name.
   */
  repo: string;

  /**
   * The contents of the `package.json` file.
   */
  data: unknown;
}

/**
 * Main environment variables.
 */
interface IEnvironment {
  /**
   * The project name as provided the CI Tool.
   */
  projectName: string;

  /**
   * The build configuration name of the CI Tool.
   */
  configName: string;

  /**
   * The id of the current build that CI uses internally.
   */
  buildId: string;

  /**
   * The number of the current build (for example, "4").
   */
  buildNumber: string;

  /**
   * If the current job is a pull request, the name of the branch from which the
   * PR originated.
   */
  pullRequestBranch: string;

  /**
   * The pull request number if the current job is a pull request.
   */
  pullRequestNumber: string;

  /**
   * For push builds, or builds not triggered by a pull request, this is the
   * name of the branch. For builds triggered by a pull request this is the name
   * of the branch targeted by the pull request.
   */
  targetBranch: string;

  /**
   * The commit subject and body, unwrapped.
   */
  commitMessage: string;

  /**
   * The commit the current job is testing.
   */
  commit: string;
}

/**
 * Environment variables that may be set by the user in a CI tool.
 */
enum ENV {
  CI = 'CI',
  GITHUB_TOKEN = 'GITHUB_TOKEN',
  RELEASE_SETUP = 'RELEASE_SETUP',
  PRE_RELEASE = 'PRE_RELEASE',
  PROJECT_NAME = 'PROJECT_NAME',
  CONFIG_NAME = 'CONFIG_NAME',
}

/**
 * Wrapper for `process.env` to obtain an `Option`.
 */
const getEnv = (varName: string): Option<string> => {
  return Maybe(process.env[varName]);
};

export { IPackageInfo, IEnvironment, getEnv, ENV };
