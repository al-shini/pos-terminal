#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * One-shot POS release tool.
 * ---------------------------------------------------------------------------
 * Replaces the manual "build → upload to GCS → edit head-office _params" dance
 * with a single command:
 *
 *     npm run release                 # build, upload, publish current version
 *     npm run release -- --bump patch # bump x.y.Z, then do the above
 *     npm run release -- --no-build   # skip the build, just (re)upload + publish
 *     npm run release -- --dry-run    # show what WOULD happen, change nothing
 *
 * What it does, in order:
 *   1. Resolves the release version (package.json "version", optionally bumped).
 *      This is the single source of truth — `.env` maps
 *      REACT_APP_VERSION=$npm_package_version, so the installed app reports the
 *      same string we publish as LAST_VERSION.
 *   2. Runs `npm run make` (react build + electron-builder) unless --no-build.
 *   3. Finds the produced Windows installer (.exe) under dist/.
 *   4. Uploads it to the configured Google Cloud Storage bucket (public).
 *   5. Upserts LAST_VERSION + LAST_VERSION_LINK in the _params table of each
 *      configured head-office database. Stores then surface the update button.
 *
 * Configuration lives in release.config.json (gitignored) — copy
 * release.config.example.json and fill it in. Secrets may also come from env
 * vars (see resolveConfig()).
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const APP_ROOT = path.resolve(__dirname, '..');
const PKG_PATH = path.join(APP_ROOT, 'package.json');

// ---------------------------------------------------------------------------
// arg parsing (no external dep)
// ---------------------------------------------------------------------------
function parseArgs(argv) {
    const args = { bump: null, build: true, dryRun: false, targets: null, config: null, version: null };
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a === '--no-build') args.build = false;
        else if (a === '--dry-run') args.dryRun = true;
        else if (a === '--bump') args.bump = argv[++i];
        else if (a === '--version') args.version = argv[++i];
        else if (a === '--targets') args.targets = argv[++i].split(',').map((s) => s.trim()).filter(Boolean);
        else if (a === '--config') args.config = argv[++i];
        else if (a === '--help' || a === '-h') { printHelp(); process.exit(0); }
        else console.warn(`(ignoring unknown arg: ${a})`);
    }
    return args;
}

function printHelp() {
    console.log(`POS release tool

Usage: node scripts/release.js [options]

Options:
  --bump <patch|minor|major|x.y.z>  Bump package.json version before releasing
  --version <x.y.z>                 Set an exact version (alias for --bump x.y.z)
  --no-build                        Skip 'npm run make' (upload existing dist artifact)
  --targets <a,b>                   Only publish to these head offices (by name)
  --config <path>                   Path to release.config.json
  --dry-run                         Print actions without building/uploading/writing
  -h, --help                        Show this help`);
}

// ---------------------------------------------------------------------------
// version helpers
// ---------------------------------------------------------------------------
function readPkg() {
    return JSON.parse(fs.readFileSync(PKG_PATH, 'utf8'));
}

function bumpSemver(current, bump) {
    if (!bump) return current;
    if (/^\d+\.\d+\.\d+/.test(bump)) return bump; // explicit version
    const m = String(current).match(/^(\d+)\.(\d+)\.(\d+)(.*)$/);
    if (!m) throw new Error(`Cannot parse current version "${current}" for bump "${bump}"`);
    let [maj, min, pat] = [Number(m[1]), Number(m[2]), Number(m[3])];
    if (bump === 'major') { maj++; min = 0; pat = 0; }
    else if (bump === 'minor') { min++; pat = 0; }
    else if (bump === 'patch') { pat++; }
    else throw new Error(`Unknown --bump "${bump}" (use patch|minor|major|x.y.z)`);
    return `${maj}.${min}.${pat}`;
}

function writePkgVersion(version) {
    const raw = fs.readFileSync(PKG_PATH, 'utf8');
    // Preserve formatting: replace only the top-level "version" line.
    const updated = raw.replace(/("version"\s*:\s*")[^"]*(")/, `$1${version}$2`);
    fs.writeFileSync(PKG_PATH, updated);
}

// ---------------------------------------------------------------------------
// config
// ---------------------------------------------------------------------------
function resolveConfig(args) {
    const configPath = args.config
        ? path.resolve(process.cwd(), args.config)
        : path.join(APP_ROOT, 'release.config.json');

    let fileCfg = {};
    if (fs.existsSync(configPath)) {
        fileCfg = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    } else {
        console.warn(`No config file at ${configPath} — relying on env vars.`);
    }

    const gcs = fileCfg.gcs || {};
    const cfg = {
        configPath,
        gcs: {
            bucket: process.env.GCS_BUCKET || gcs.bucket,
            prefix: (process.env.GCS_PREFIX || gcs.prefix || '').replace(/^\/+|\/+$/g, ''),
            keyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS || gcs.keyFile || null,
            projectId: process.env.GCS_PROJECT_ID || gcs.projectId || null,
            makePublic: gcs.makePublic !== undefined ? gcs.makePublic : true,
            publicBaseUrl: gcs.publicBaseUrl || 'https://storage.googleapis.com'
        },
        // each: { name, connectionString } OR { name, host, port, database, user, password, ssl }
        headOffices: fileCfg.headOffices || [],
        distDir: path.resolve(APP_ROOT, fileCfg.distDir || 'dist'),
        // Optional override for the uploaded object's base filename. When null
        // (default) we PRESERVE the original installer name produced by
        // electron-builder (e.g. "Dazzle POS Setup 5.0.2.exe"), matching the
        // existing convention in the bucket.
        artifactBaseName: fileCfg.artifactBaseName || null
    };

    // Allow a single HO via env for quick setups.
    if (cfg.headOffices.length === 0 && process.env.HO_DATABASE_URL) {
        cfg.headOffices.push({ name: 'default', connectionString: process.env.HO_DATABASE_URL });
    }
    return cfg;
}

function validateConfig(cfg) {
    const errors = [];
    if (!cfg.gcs.bucket) errors.push('gcs.bucket (or env GCS_BUCKET) is required');
    if (!cfg.headOffices.length) errors.push('headOffices[] (or env HO_DATABASE_URL) is required');
    if (errors.length) {
        throw new Error('Invalid release config:\n  - ' + errors.join('\n  - '));
    }
}

// ---------------------------------------------------------------------------
// build
// ---------------------------------------------------------------------------
function runBuild(dryRun) {
    console.log('\n=== [1/3] Building (npm run make) ===');
    if (dryRun) { console.log('  (dry-run) skipping build'); return; }
    // Run through a shell so Windows can resolve `npm` (npm.cmd). Node >=18.20
    // refuses to spawn .cmd/.bat without a shell (CVE-2024-27980), which
    // otherwise surfaces as a confusing "exit code null".
    const res = spawnSync('npm run make', {
        cwd: APP_ROOT, stdio: 'inherit', env: process.env, shell: true
    });
    if (res.error) {
        throw new Error(`Could not start the build ('npm run make'): ${res.error.message}`);
    }
    if (res.status !== 0) {
        throw new Error(`'npm run make' failed with exit code ${res.status}`);
    }
}

// ---------------------------------------------------------------------------
// artifact discovery
// ---------------------------------------------------------------------------
function findInstaller(distDir, version) {
    if (!fs.existsSync(distDir)) {
        throw new Error(`dist directory not found: ${distDir} (did the build run?)`);
    }
    const exes = [];
    const walk = (dir) => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) walk(full);
            else if (entry.isFile() && /\.exe$/i.test(entry.name)) exes.push(full);
        }
    };
    walk(distDir);
    if (!exes.length) throw new Error(`No .exe installer found under ${distDir}`);

    // Prefer a file whose name contains the version; else newest by mtime.
    const versioned = exes.filter((f) => path.basename(f).includes(version));
    const pool = versioned.length ? versioned : exes;
    pool.sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
    if (!versioned.length) {
        console.warn(`  WARNING: no installer filename contained "${version}"; using newest .exe: ${path.basename(pool[0])}`);
    }
    return pool[0];
}

// ---------------------------------------------------------------------------
// GCS upload
// ---------------------------------------------------------------------------
async function uploadToGcs(cfg, localPath, version, dryRun) {
    console.log('\n=== [2/3] Uploading installer to GCS ===');
    // Preserve the original installer name unless an explicit base name is set.
    const fileName = cfg.gcs.artifactBaseName
        ? `${cfg.gcs.artifactBaseName}-${version}.exe`
        : path.basename(localPath);
    const objectPath = [cfg.gcs.prefix, fileName].filter(Boolean).join('/');
    // Object names may contain spaces; the public URL must be percent-encoded
    // per path segment so the login-screen downloader gets a valid link.
    const encodedPath = objectPath.split('/').map(encodeURIComponent).join('/');
    const publicUrl = `${cfg.gcs.publicBaseUrl}/${cfg.gcs.bucket}/${encodedPath}`;

    console.log(`  local : ${localPath}`);
    console.log(`  bucket: gs://${cfg.gcs.bucket}/${objectPath}`);
    console.log(`  url   : ${publicUrl}`);

    if (dryRun) { console.log('  (dry-run) skipping upload'); return publicUrl; }

    let Storage;
    try {
        ({ Storage } = require('@google-cloud/storage'));
    } catch (e) {
        throw new Error("Missing dependency '@google-cloud/storage'. Run: npm install");
    }
    const storageOpts = {};
    if (cfg.gcs.keyFile) storageOpts.keyFilename = cfg.gcs.keyFile;
    if (cfg.gcs.projectId) storageOpts.projectId = cfg.gcs.projectId;
    const storage = new Storage(storageOpts);

    await storage.bucket(cfg.gcs.bucket).upload(localPath, {
        destination: objectPath,
        resumable: true,
        metadata: { cacheControl: 'no-cache, max-age=0' }
    });

    if (cfg.gcs.makePublic) {
        try {
            await storage.bucket(cfg.gcs.bucket).file(objectPath).makePublic();
        } catch (e) {
            console.warn(`  NOTE: makePublic failed (${e.message}). If the bucket uses uniform/`
                + `public IAM this is expected and the object is already reachable.`);
        }
    }
    console.log('  upload OK');
    return publicUrl;
}

// ---------------------------------------------------------------------------
// head-office _params update
// ---------------------------------------------------------------------------
async function updateHeadOffice(ho, version, link, dryRun) {
    const label = ho.name || ho.host || 'head-office';
    console.log(`\n  -> ${label}`);
    if (dryRun) {
        console.log('     (dry-run) would set LAST_VERSION=' + version);
        console.log('     (dry-run) would set LAST_VERSION_LINK=' + link);
        return { name: label, ok: true, dryRun: true };
    }

    let Client;
    try {
        ({ Client } = require('pg'));
    } catch (e) {
        throw new Error("Missing dependency 'pg'. Run: npm install");
    }

    const clientCfg = ho.connectionString
        ? { connectionString: ho.connectionString, ssl: ho.ssl }
        : {
            host: ho.host, port: ho.port || 5432, database: ho.database,
            user: ho.user, password: ho.password, ssl: ho.ssl
        };

    const client = new Client(clientCfg);
    const upsert = async (key, value) => {
        // No assumption about a unique constraint on param_key: update first,
        // insert only if nothing was updated.
        const upd = await client.query(
            'UPDATE _params SET param_value = $1 WHERE param_key = $2', [value, key]);
        if (upd.rowCount === 0) {
            await client.query(
                'INSERT INTO _params (param_key, param_value) VALUES ($1, $2)', [key, value]);
        }
    };

    try {
        await client.connect();
        await client.query('BEGIN');
        await upsert('LAST_VERSION', version);
        await upsert('LAST_VERSION_LINK', link);
        await client.query('COMMIT');
        console.log('     params updated (LAST_VERSION, LAST_VERSION_LINK)');
        return { name: label, ok: true };
    } catch (e) {
        try { await client.query('ROLLBACK'); } catch (_) { /* ignore */ }
        console.error(`     FAILED: ${e.message}`);
        return { name: label, ok: false, error: e.message };
    } finally {
        try { await client.end(); } catch (_) { /* ignore */ }
    }
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------
async function main() {
    const args = parseArgs(process.argv.slice(2));
    const cfg = resolveConfig(args);
    validateConfig(cfg);

    const pkg = readPkg();
    const bumpSpec = args.version || args.bump;
    const version = bumpSemver(pkg.version, bumpSpec);

    console.log('POS Release');
    console.log('===========');
    console.log(`current version : ${pkg.version}`);
    console.log(`release version : ${version}${bumpSpec ? ` (bump: ${bumpSpec})` : ''}`);
    console.log(`config          : ${cfg.configPath}`);
    console.log(`bucket          : gs://${cfg.gcs.bucket}/${cfg.gcs.prefix}`);
    const targets = args.targets
        ? cfg.headOffices.filter((h) => args.targets.includes(h.name))
        : cfg.headOffices;
    console.log(`head offices    : ${targets.map((h) => h.name).join(', ') || '(none)'}`);
    if (args.dryRun) console.log('mode            : DRY RUN (no changes)');

    if (!targets.length) throw new Error('No matching head offices to publish to.');

    // Persist the bumped version BEFORE building so REACT_APP_VERSION matches.
    if (bumpSpec && version !== pkg.version) {
        if (args.dryRun) console.log(`\n(dry-run) would set package.json version to ${version}`);
        else { writePkgVersion(version); console.log(`\npackage.json version set to ${version}`); }
    }

    if (args.build) runBuild(args.dryRun);
    else console.log('\n=== [1/3] Build skipped (--no-build) ===');

    const installer = args.dryRun && args.build
        ? '(dry-run: installer not built)'
        : findInstaller(cfg.distDir, version);
    if (!args.dryRun || !args.build) console.log(`installer       : ${installer}`);

    const placeholderName = cfg.gcs.artifactBaseName
        ? `${cfg.gcs.artifactBaseName}-${version}.exe`
        : `Dazzle POS Setup ${version}.exe`;
    const link = await uploadToGcs(
        cfg,
        (args.dryRun && args.build) ? path.join(cfg.distDir, placeholderName) : installer,
        version,
        args.dryRun
    );

    console.log('\n=== [3/3] Publishing to head office(s) ===');
    const results = [];
    for (const ho of targets) {
        results.push(await updateHeadOffice(ho, version, link, args.dryRun));
    }

    console.log('\n=== Summary ===');
    console.log(`version : ${version}`);
    console.log(`link    : ${link}`);
    for (const r of results) {
        console.log(`  ${r.ok ? 'OK  ' : 'FAIL'} ${r.name}${r.error ? ' — ' + r.error : ''}`);
    }
    const failed = results.filter((r) => !r.ok);
    if (failed.length) {
        console.error(`\n${failed.length} head office update(s) failed.`);
        process.exit(1);
    }
    console.log('\nDone. Stores will offer v' + version + ' on the login screen.');
}

main().catch((err) => {
    console.error('\nRelease failed:', err.message);
    process.exit(1);
});
