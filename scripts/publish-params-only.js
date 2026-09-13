#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * One-off: update LAST_VERSION / LAST_VERSION_LINK in a head office WITHOUT
 * building or uploading. Used when the installer is already in GCS but the
 * DB publish step failed (e.g. VPN outage mid-release).
 *
 *   node scripts/publish-params-only.js --target palestine --version 5.2.6 \
 *        --link "https://storage.googleapis.com/..."
 */
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const args = {};
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--target') args.target = argv[++i];
    else if (argv[i] === '--version') args.version = argv[++i];
    else if (argv[i] === '--link') args.link = argv[++i];
}
if (!args.target || !args.version || !args.link) {
    console.error('Usage: --target <name> --version <x.y.z> --link <url>');
    process.exit(1);
}

const cfg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'release.config.json'), 'utf8'));
const ho = (cfg.headOffices || []).find((h) => h.name === args.target);
if (!ho) { console.error(`No head office named "${args.target}" in release.config.json`); process.exit(1); }

(async () => {
    const client = new Client({
        host: ho.host, port: ho.port || 5432, database: ho.database,
        user: ho.user, password: ho.password, ssl: ho.ssl
    });
    const upsert = async (key, value) => {
        const upd = await client.query('UPDATE _params SET param_value = $1 WHERE param_key = $2', [value, key]);
        if (upd.rowCount === 0) {
            await client.query('INSERT INTO _params (param_key, param_value) VALUES ($1, $2)', [key, value]);
        }
    };
    await client.connect();
    await client.query('BEGIN');
    await upsert('LAST_VERSION', args.version);
    await upsert('LAST_VERSION_LINK', args.link);
    await client.query('COMMIT');
    const check = await client.query(
        "SELECT param_key, param_value FROM _params WHERE param_key IN ('LAST_VERSION','LAST_VERSION_LINK')");
    console.log(`[${args.target}] params now:`);
    for (const r of check.rows) console.log(`  ${r.param_key} = ${r.param_value}`);
    await client.end();
    console.log('Done.');
})().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
