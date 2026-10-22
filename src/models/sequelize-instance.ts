'use strict';

import 'dotenv/config';
import * as Sequelize from "sequelize";
import process from 'process';
import config from '../../config/config.json' with { type: "json" };

type Environment = keyof typeof config;
const env = (process.env.NODE_ENV || 'development') as Environment;
const envConfig = config[env];

if (!envConfig) {
  throw new Error(`Unsupported NODE_ENV "${env}". Expected one of: ${Object.keys(config).join(', ')}`);
}

let sequelize: Sequelize.Sequelize;
if ("use_env_variable" in envConfig) {
  const connectionUrl = process.env[envConfig.use_env_variable];
  if (!connectionUrl?.trim()) {
    throw new Error(`${envConfig.use_env_variable} is required when NODE_ENV=${env}. Set it in the hosting environment.`);
  }
  sequelize = new Sequelize.Sequelize(connectionUrl, {
    ...envConfig,
    dialect: envConfig.dialect,
    dialectOptions: process.env.DB_SSL === 'true'
      ? { ssl: { rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false' } }
      : undefined,
  } as any);
} else {
  sequelize = new Sequelize.Sequelize(envConfig.database, envConfig.username, envConfig.password, envConfig as any);
}

export { sequelize, Sequelize };
