import Knex from 'knex';
import { config } from '../config';

export const db = Knex({
  client: 'mysql2',
  connection: {
    host: config.db.host,
    port: config.db.port,
    user: config.db.user,
    password: config.db.password,
    database: config.db.name,
    charset: 'utf8mb4',
  },
  pool: { min: 0, max: 10 },
});
