const webpack = require('webpack');
const chalk = require('chalk');

const log = require('../core/log');

const Context = require('../core/Context');

module.exports = async function({
  args,
  rootDir,
}) {
  const command = 'build';

  const context = new Context({
    args,
    command,
    rootDir,
  });

  const { applyHook } = context;

  await applyHook(`before.${command}`);

  const configArr = await context.getConfig();

  for (const item of configArr) {
    const { name, chainConfig } = item;

    await applyHook(`before.${command}.${name}`);

    const webpackConfig = chainConfig.toConfig();

    let compiler;
    try {
      compiler = webpack(webpackConfig);
    } catch (err) {
      log.error(chalk.red('Failed to load webpack config.'));
      log.error(err.message || err);
      process.exit(1);
    }

    compiler.hooks.done.tap('done', (stats) => {
      if (stats.hasErrors()) {
        return console.error(
          stats.toString({
            colors: true,
          }),
        );
      }

      console.log(
        stats.toString({
          assets: true,
          colors: true,
          chunks: false,
          entrypoints: false,
          modules: false,
        }),
      );
    });

    if (compiler.hooks.failed) {
      compiler.hooks.failed.call('failed', (err) => {
        throw err;
      });
    }

    compiler.run((err) => {
      if (err) {
        throw err;
      }

      log.info(chalk.green('\nBuild successfully.'));
      process.exit();
    });

    await applyHook(`after.${command}.${name}`);
  }

  await applyHook(`after.${command}`);
};
