'use strict';

import * as Sequelize from "sequelize";
import process from 'process';
import config from '../../config/config.json' with { type: "json" };

type Environment = keyof typeof config;
const env = (process.env.NODE_ENV || 'development') as Environment;
const envConfig = config[env];

let sequelize: Sequelize.Sequelize;
if ("use_env_variable" in envConfig) {
  sequelize = new Sequelize.Sequelize(envConfig.use_env_variable, envConfig as any);
} else {
  sequelize = new Sequelize.Sequelize(envConfig.database, envConfig.username, envConfig.password, envConfig as any);
}

export { sequelize, Sequelize };