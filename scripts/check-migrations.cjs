/**
 * Migration security guard (see issue #139).
 * Every CREATE FUNCTION in api/migrations must have a matching
 * REVOKE ALL ... FROM PUBLIC, otherwise the function is executable by
 * anon/authenticated roles (PostgreSQL default). Run via `npm run guard:migrations`.
 */
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..', 'api', 'migrations');
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.sql'));

const created = new Map(); // signature -> file
const revoked = new Set();

const normalize = (s) => s.replace(/\s+/g, ' ').replace(/,\s*/g, ',').trim().toLowerCase();

for (const file of files) {
    const sql = fs.readFileSync(path.join(dir, file), 'utf8');
    const createRe = /create\s+(?:or\s+replace\s+)?function\s+public\.(\w+)\s*\(([^;]*?)\)/gi;
    let match;
    while ((match = createRe.exec(sql)) !== null) {
        const sig = `${match[1]}(${match[2].split(',').map((a) => {
            const noDefault = a.trim().replace(/\bDEFAULT\b.*$/i, '').trim();
            const tokens = noDefault.split(/\s+/);
            if (tokens[0] && /^p_/i.test(tokens[0])) tokens.shift();
            return tokens.join(' ');
        }).join(',')})`;
        created.set(normalize(sig), file);
    }
    const revokeRe = /revoke\s+all\s+on\s+function\s+public\.(\w+)\s*\(([^)]*)\)\s*from\s+public/gi;
    while ((match = revokeRe.exec(sql)) !== null) {
        revoked.add(normalize(`${match[1]}(${match[2]})`));
    }
}

let failed = false;
for (const [sig, file] of created) {
    if (!revoked.has(sig)) {
        console.error(`UNREVOKED: ${sig} (created in ${file})`);
        failed = true;
    }
}

if (failed) {
    console.error('\nEvery migration function needs REVOKE ALL ... FROM PUBLIC.');
    process.exit(1);
}
console.log(`migration guard PASSED (${created.size} functions, all revoked from PUBLIC)`);
