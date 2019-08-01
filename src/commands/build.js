const webpack = require('webpack');
const fs = require('fs-extra');
const path = require('path');
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

  const { applyHook, rootDir: ctxRoot } = context;

  await applyHook(`before.${command}`);

  const configArr = await context.getConfig();

  // clear build directory
  let buildPath = path.resolve(ctxRoot, 'build');
  if (configArr.length) {
    const userBuildPath = configArr[0].chainConfig.toConfig().output.path;
    if (userBuildPath) {
      buildPath = path.resolve(ctxRoot, userBuildPath);
    }
  }
  fs.removeSync(buildPath);

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

    await new Promise((resolve, reject) => {
      compiler.run((err) => {
        if (err) {
          reject();
          throw err;
        }

        log.info(chalk.green('\nBuild successfully.'));
        resolve();
      });
    })

    await applyHook(`after.${command}.${name}`);
  }

  await applyHook(`after.${command}`);
};
