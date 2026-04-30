exports.up = async function (knex) {
  await knex.schema.createTable('alerts', (t) => {
    t.bigIncrements('id').primary();
    t.string('type', 40).notNullable();
    t.string('title', 200).notNullable();
    t.text('body').notNullable();
    t.string('source', 20).notNullable();
    t.json('metadata').nullable();
    t.string('dedupe_key', 120).nullable();
    t.dateTime('created_at').notNullable().defaultTo(knex.fn.now());
    t.index(['type', 'created_at'], 'idx_type_created');
    t.index(['created_at'], 'idx_created');
    t.index(['dedupe_key', 'created_at'], 'idx_dedupe');
  });

  await knex.schema.createTable('devices', (t) => {
    t.bigIncrements('id').primary();
    t.string('fcm_token', 255).notNullable().unique();
    t.enu('platform', ['android', 'ios']).notNullable();
    t.string('device_name', 120).nullable();
    t.string('user_label', 120).nullable();
    t.boolean('active').notNullable().defaultTo(true);
    t.dateTime('created_at').notNullable().defaultTo(knex.fn.now());
    t.dateTime('last_seen_at').nullable();
  });

  await knex.schema.createTable('alert_reads', (t) => {
    t.bigInteger('device_id').unsigned().notNullable();
    t.bigInteger('alert_id').unsigned().notNullable();
    t.dateTime('read_at').notNullable().defaultTo(knex.fn.now());
    t.primary(['device_id', 'alert_id']);
  });

  await knex.schema.createTable('delivery_log', (t) => {
    t.bigIncrements('id').primary();
    t.bigInteger('alert_id').unsigned().notNullable();
    t.bigInteger('device_id').unsigned().notNullable();
    t.enu('status', ['sent', 'failed', 'retry']).notNullable();
    t.text('fcm_response').nullable();
    t.integer('attempts').notNullable().defaultTo(1);
    t.dateTime('next_retry_at').nullable();
    t.dateTime('created_at').notNullable().defaultTo(knex.fn.now());
    t.index(['status', 'next_retry_at'], 'idx_retry');
    t.index(['alert_id'], 'idx_alert');
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('delivery_log');
  await knex.schema.dropTableIfExists('alert_reads');
  await knex.schema.dropTableIfExists('devices');
  await knex.schema.dropTableIfExists('alerts');
};
