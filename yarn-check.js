if (!process.env.npm_config_user_agent.startsWith('yarn/')) {
  console.log('Use `yarn` to install dependencies in this repository\n');
  process.exit(1);
} else {
  process.exit(0);
}
