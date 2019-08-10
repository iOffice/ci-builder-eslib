import { IEnvironment, getEnv, ENV } from './Helpers';

/**
 * Environment variables provided by Travis:
 *
 * https://docs.travis-ci.com/user/environment-variables/
 */
enum TRAVIS {
  TRAVIS = 'TRAVIS',
  TRAVIS_BUILD_ID = 'TRAVIS_BUILD_ID',
  TRAVIS_BUILD_NUMBER = 'TRAVIS_BUILD_NUMBER',
  TRAVIS_PULL_REQUEST_BRANCH = 'TRAVIS_PULL_REQUEST_BRANCH',
  TRAVIS_PULL_REQUEST = 'TRAVIS_PULL_REQUEST',
  TRAVIS_BRANCH = 'TRAVIS_BRANCH',
  TRAVIS_COMMIT_MESSAGE = 'TRAVIS_COMMIT_MESSAGE',
  TRAVIS_COMMIT = 'TRAVIS_COMMIT',
}

/**
 * Maps the environment variables provided by TravisCI to the IEnvironment
 * interface.
 */
const getTravisEnvironment = (): IEnvironment => {
  return {
    projectName: getEnv(ENV.PROJECT_NAME).getOrElse(''),
    configName: getEnv(ENV.CONFIG_NAME).getOrElse(''),
    buildId: getEnv(TRAVIS.TRAVIS_BUILD_ID).getOrElse(''),
    buildNumber: getEnv(TRAVIS.TRAVIS_BUILD_NUMBER).getOrElse(''),
    pullRequestBranch: getEnv(TRAVIS.TRAVIS_PULL_REQUEST_BRANCH).getOrElse(''),
    pullRequestNumber: getEnv(TRAVIS.TRAVIS_PULL_REQUEST).getOrElse(''),
    targetBranch: getEnv(TRAVIS.TRAVIS_BRANCH).getOrElse(''),
    commitMessage: getEnv(TRAVIS.TRAVIS_COMMIT_MESSAGE).getOrElse(''),
    commit: getEnv(TRAVIS.TRAVIS_COMMIT).getOrElse(''),
  };
};

export { TRAVIS, getTravisEnvironment };
