const _ = require('lodash');
const path = require('path');
const autoBind = require('auto-bind');
const fs = require('fs-extra');

const log = require('./log');

const PKG_FILE = 'package.json';
const USER_CONFIG_FILE = 'build.json';

module.exports = class Context {
  constructor({
    command,
    rootDir = process.cwd(),
    args = {} }
  ) {
    autoBind(this);

    this.command = command;
    this.commandArgs = args;
    this.rootDir = rootDir;

    this.configArr = []; // 配置
    this.webpackFns = []; // 插件注册的修改函数
    this.eventHooks = {}; // 插件注册的生命周期函数

    this.pkg = this.getProjectFile(PKG_FILE);

    this.userConfig = this.getUserConfig();

    this.plugins = this.getPlugins();
  }

  getProjectFile(fileName) {
    const configPath = path.resolve(this.rootDir, fileName);

    let config = {};
    if (fs.existsSync(configPath)) {
      try {
        config = fs.readJsonSync(configPath);
      } catch (err) {
        log.info('CONFIG', `Fail to load config file ${configPath}, use empty object`);
      }
    }

    return config;
  }

  getUserConfig() {
    const { config } = this.commandArgs;
    let configPath = '';
    if (config) {
      configPath = path.isAbsolute(config) ? config : path.resolve(this.rootDir, config);
    } else {
      configPath = path.resolve(this.rootDir, USER_CONFIG_FILE);
    }
    let userConfig = {};
    if (fs.existsSync(configPath)) {
      try {
        userConfig = fs.readJsonSync(configPath);
      } catch (err) {
        log.info('CONFIG', `Fail to load config file ${configPath}, use default config instead`);
        log.error(err);
        process.exit(1);
      }
    }

    return userConfig;
  }

  getPlugins() {
    const userPlugins = this.userConfig.plugins.map((pluginInfo) => {
      let fn = () => {};

      const plugins = Array.isArray(pluginInfo) ? pluginInfo : [pluginInfo];

      const pluginPath = require.resolve(plugins[0], { paths: [this.rootDir] });
      const options = plugins[1];

      try {
        fn = require(pluginPath); // eslint-disable-line
      } catch (err) {
        log.error(`Fail to load plugin ${pluginPath}`);
        log.error(err);
        process.exit(1);
      }

      return {
        name: pluginPath,
        fn,
        options,
      };
    });

    return userPlugins;
  }

  registerConfig(name, chainConfig) {
    chainConfig.get = (configName) => {
      const configInfo = this.configArr.find(v => v.name === configName);
      return configInfo.chainConfig;
    };

    this.configArr.push({
      name,
      chainConfig,
    });
  }

  chainWebpack(fn) {
    const fnInfo = this.webpackFns.find(v => v.name === this.pluginName);
    if (!fnInfo) {
      this.webpackFns.push({
        name: this.pluginName,
        chainWebpack: [fn],
      });
    } else {
      fnInfo.chainWebpack.push(fn);
    }
  }

  onHook(key, fn) {
    if (!Array.isArray(this.eventHooks[key])) {
      this.eventHooks[key] = [];
    }
    this.eventHooks[key].push(fn);
  }

  async applyHook(key, opts = {}) {
    const hooks = this.eventHooks[key] || [];

    for (const fn of hooks) {
      await fn(opts);
    }
  }

  async runPlugins() {
    for (const pluginInfo of this.plugins) {
      const { fn, options } = pluginInfo;
      const pluginAPI = _.pick(this, [
        'command',
        'commandArgs',
        'rootDir',
        'userConfig',
        'pkg',

        'registerConfig',
        'chainWebpack',
        'onHook',
      ]);
      await fn(pluginAPI, options);
    }
  }

  async runWebpackFn() {
    this.webpackFns.forEach((plugins) => {
      const { chainWebpack } = plugins;
      const configApi = this.configArr[0].chainConfig;

      chainWebpack.forEach(fn => {
        fn(configApi, {
          command: this.command,
        });
      });
    });
  }

  async getConfig() {
    await this.runPlugins();
    await this.runWebpackFn();

    return this.configArr;
  }
};
