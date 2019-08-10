import { IEnvironment, getEnv } from './Helpers';

/**
 * Environment variables provided by iOFFICE TeamCity builds:
 *
 * These environment variables are defined by iOFFICE in a bash script so that
 * node may have access to them:
 *
 * ```
 * export TEAMCITY_PROJECT_NAME=%env.TEAMCITY_PROJECT_NAME%
 * export TEAMCITY_BUILDCONF_NAME=%env.TEAMCITY_BUILDCONF_NAME%
 * export TEAMCITY_BUILD_ID=%teamcity.build.id%
 * export TEAMCITY_BUILD_NUMBER=%env.BUILD_NUMBER%
 * export TEAMCITY_BRANCH=%teamcity.build.branch%
 * ```
 */
enum TC {
  TEAMCITY = 'TEAMCITY',
  TEAMCITY_PROJECT_NAME = 'TEAMCITY_PROJECT_NAME',
  TEAMCITY_BUILDCONF_NAME = 'TEAMCITY_BUILDCONF_NAME',
  TEAMCITY_BUILD_ID = 'TEAMCITY_BUILD_ID',
  TEAMCITY_BUILD_NUMBER = 'TEAMCITY_BUILD_NUMBER',
  TEAMCITY_PULL_REQUEST_BRANCH = 'TEAMCITY_PULL_REQUEST_BRANCH',
  TEAMCITY_PULL_REQUEST_NUMBER = 'TEAMCITY_PULL_REQUEST_NUMBER',
  TEAMCITY_TARGET_BRANCH = 'TEAMCITY_TARGET_BRANCH',
  TEAMCITY_COMMIT_MESSAGE = 'TEAMCITY_COMMIT_MESSAGE',
  TEAMCITY_COMMIT = 'TEAMCITY_COMMIT',
}
/**
 * Maps the environment variables provided by TravisCI to the IEnvironment
 * interface.
 */
const getTeamCityEnvironment = (): IEnvironment => {
  return {
    projectName: getEnv(TC.TEAMCITY_PROJECT_NAME).getOrElse(''),
    configName: getEnv(TC.TEAMCITY_BUILDCONF_NAME).getOrElse(''),
    buildId: getEnv(TC.TEAMCITY_BUILD_ID).getOrElse(''),
    buildNumber: getEnv(TC.TEAMCITY_BUILD_NUMBER).getOrElse(''),
    pullRequestBranch: getEnv(TC.TEAMCITY_PULL_REQUEST_BRANCH).getOrElse(''),
    pullRequestNumber: getEnv(TC.TEAMCITY_PULL_REQUEST_NUMBER).getOrElse(''),
    targetBranch: getEnv(TC.TEAMCITY_TARGET_BRANCH).getOrElse(''),
    commitMessage: getEnv(TC.TEAMCITY_COMMIT_MESSAGE).getOrElse(''),
    commit: getEnv(TC.TEAMCITY_COMMIT).getOrElse(''),
  };
};

export { TC, getTeamCityEnvironment };
