# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/en/1.0.0/) and this project
adheres to [Semantic Versioning](http://semver.org/spec/v2.0.0.html).

As per semantic versioning

> Major version zero (0.y.z) is for initial development. Anything may change at any time.
> The public API should not be considered stable.


## [Unreleased]

## [0.5.3] - September 13, 2020
- Removed unnecessary peer dependencies since we are using pnpm.
- NPM registry matches in both .npmrc file package.json file.


## [0.5.2] - September 11, 2020
- Removed yarn-check.js from published package.


## [0.5.1] - September 11, 2020
- Fixed logic to only lint project files.


## [0.5.0] - September 11, 2020
- Linting only project files
- If `TC` is an environment variable then a Teamcity environment is assumed.


## [0.4.0] - April 20, 2020
- Same as 0.3.x except that node 8 is no longer included in the PR builds.


## [0.3.3] - April 19, 2020
- Everything should still be the same. libraries were updated in the project
  to remove dependencies and to make the code a bit easier to read.
- Versions `0.3.0` to `0.3.2` are the same as this one except that they did not get tagged in
  github.


## [0.2.0] - August 13, 2019
*Breaking Changes*
- `ioffice-tsc` no longer looks for allowed errors in `package.json`. Instead it looks for them
  in the tsconfig file which was used as an argument.

*Features*
- `tsconfig.core.ts` provides a basic configuration for typescript projects.


## [0.1.0] - August 12, 2019
*Breaking Changes*
- Removed fp tools. It is now a peer dependency.
- `isRelease` and `isReleasePullRequest` are now asynchronous.

*Features*
- Added `getNodeVersion` to the buildUtil service. Useful to prevent multiple builds from
  attempting to release at the same time.


## [0.0.1] - August 10, 2019
- Migrated tc-builder modified source code to this project.


[Unreleased]: https://github.com/iOffice/ci-builder-eslib/compare/0.5.3...HEAD
[0.5.3]: https://github.com/iOffice/ci-builder-eslib/compare/0.5.2...0.5.3
[0.5.2]: https://github.com/iOffice/ci-builder-eslib/compare/0.5.1...0.5.2
[0.5.1]: https://github.com/iOffice/ci-builder-eslib/compare/0.5.0...0.5.1
[0.5.0]: https://github.com/iOffice/ci-builder-eslib/compare/0.4.0...0.5.0
[0.4.0]: https://github.com/iOffice/ci-builder-eslib/compare/0.3.3...0.4.0
[0.3.3]: https://github.com/iOffice/ci-builder-eslib/compare/0.2.0...0.3.3
[0.2.0]: https://github.com/iOffice/ci-builder-eslib/compare/0.1.0...0.2.0
[0.1.0]: https://github.com/iOffice/ci-builder-eslib/compare/0.0.1...0.1.0
[0.0.1]: https://github.com/iOffice/ci-builder-eslib/compare/feda23fef09b15cae64ba9bece252f145ecbb974...0.0.1
