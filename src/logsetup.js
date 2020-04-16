const log = require('loglevel');
const logPrefix = require('loglevel-plugin-prefix');
const chalk = require('chalk');

/** Set up logging
 *
 */
module.exports.logSetup = () => {
  const colors = {
    TRACE: chalk.magenta,
    DEBUG: chalk.blueBright,
    INFO: chalk.cyan,
    WARN: chalk.yellow,
    ERROR: chalk.red,
  };
  logPrefix.reg(log);
  log.enableAll();
  if (process.env.LOGLEVEL === 'DEBUG') {
    log.setLevel(log.levels.DEBUG);
  } else {
    log.setLevel(log.levels.INFO);
  }
  logPrefix.apply(log, {
    format: (level, name, timestamp) => `${chalk.gray(`[${timestamp}]`)} \
  ${colors[level](`[${level}]`)}\t${chalk.green(`${name}:`)}`,
    nameFormatter: (name) => name || 'main',
    timestampFormatter: (date) =>
      date.toLocaleDateString() +
      ' ' +
      String('0' + date.getHours()).slice(-2) +
      ':' +
      String('0' + date.getMinutes()).slice(-2) +
      ':' +
      String('0' + date.getSeconds()).slice(-2),
    levelFormatter: (level) => level.toUpperCase(),
  });
};
