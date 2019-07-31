const webpack = require('webpack');
const chalk = require('chalk');
const deepmerge = require('deepmerge');
const address = require('address');
const WebpackDevServer = require('webpack-dev-server');

const log = require('../core/log');

const Context = require('../core/Context');

module.exports = async function({
  args,
  rootDir,
}) {
  const command = 'dev';

  const context = new Context({
    args,
    command,
    rootDir,
  });

  const { applyHook } = context;
  await applyHook(`before.${command}`);

  const configArr = await context.getConfig();

  let devServerConfig = {
    port: 9999,
    host: address.ip(),
  };

  for (const item of configArr) {
    const { chainConfig } = item;

    const webpackConfig = chainConfig.toConfig();

    if (webpackConfig.devServer) {
      devServerConfig = deepmerge(devServerConfig, webpackConfig.devServer);
    }
  }


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

    const devServer = new WebpackDevServer(compiler, devServerConfig);

    devServer.listen(devServerConfig.port, devServerConfig.host, (err) => {
      if (err) {
        console.log(chalk.red('[ERR]: Failed to start webpack dev server'));
        console.error(err.message || err);
        process.exit(1);
      }

      const serverUrl = `http://${devServerConfig.host}:${devServerConfig.port}`;

      console.log(chalk.green('[Web] Starting the development server at:'));
      console.log('   ', chalk.underline.white(serverUrl));

      ['SIGINT', 'SIGTERM'].forEach(function(sig) {
        process.on(sig, function() {
          devServer.close();
          process.exit();
        });
      });
    });

    await applyHook(`after.${command}.${name}`);
  }

  await applyHook(`after.${command}`);
};
