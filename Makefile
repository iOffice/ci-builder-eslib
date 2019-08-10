preRelease: clean build
	PRE_RELEASE=true node build/build.js

releaseSetup: clean build
	RELEASE_SETUP=true node build/build.js

run: preTest
	node build/build.js

## Dependencies

build: FORCE compile

compile:
	tsc

clean:
	rm -rf build

FORCE:

## Core

preTest: compile
	node build/builder.test.js
