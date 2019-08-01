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
  if (configArr.length) {
    let buildPath = path.resolve(ctxRoot, 'build');

    try {
      const userBuildPath = configArr[0].chainConfig.toConfig().output.path;
      buildPath = path.resolve(ctxRoot, userBuildPath);
    } catch (e) {
      // do nothing
    }

    fs.removeSync(buildPath);
  }

  const webpackConfig = configArr.map(v => v.chainConfig.toConfig());

  let compiler;
  try {
    compiler = webpack(webpackConfig);
  } catch (err) {
    log.error(chalk.red('Failed to load webpack config.'));
    log.error(err);
    process.exit(1);
  }

  await new Promise((resolve) => {
    compiler.run((err, stats) => {
      if (err) {
        console.error(err.stack || err);
        if (err.details) {
          console.error(err.details);
        }
        process.exit(1);
      }

      const info = stats.toJson();

      if (stats.hasErrors()) {
        console.error(info.errors);
      }

      if (stats.hasWarnings()) {
        console.warn(info.warnings);
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

      log.info(chalk.green('\nBuild successfully.'));
      resolve();
    });
  })

  await applyHook(`after.${command}`);
};
