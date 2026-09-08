// ============================================
// RESPALDO DE LA BASE DE DATOS
// Uso: npm run db:backup
// Genera backups/backup-YYYY-MM-DD_HH-mm.sql con el esquema + INSERTs.
// La BD en uso es la de las variables de entorno (Turso en producción).
// ============================================
const fs = require('fs');
const path = require('path');
const { initDatabase, db } = require('../config/database');

const TABLES = ['usuarios', 'remeseros', 'ordenantes', 'remesas', 'reset_tokens', 'auditoria'];

const esc = (v) => {
    if (v === null || v === undefined) return 'NULL';
    if (typeof v === 'number') return Number.isFinite(v) ? String(v) : 'NULL';
    if (typeof v === 'bigint') return String(v);
    if (typeof v === 'boolean') return v ? '1' : '0';
    return `'${String(v).replace(/'/g, "''")}'`;
};

const run = async () => {
    await initDatabase();

    const dir = path.join(__dirname, '../../backups');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const stamp = new Date().toISOString().slice(0, 16).replace('T', '_').replace(':', '-');
    const file = path.join(dir, `backup-${stamp}.sql`);

    let out = `-- Respaldo Bar Patio La China - ${new Date().toISOString()}\n`;
    out += `-- Restaurar: sqlite3 data/database.sqlite < este-archivo\n`;
    out += `PRAGMA foreign_keys=OFF;\nBEGIN TRANSACTION;\n`;

    for (const t of TABLES) {
        const colsRes = await db.query(`PRAGMA table_info(${t})`);
        if (!colsRes.rows || colsRes.rows.length === 0) {
            out += `\n-- Tabla ${t}: no existe, se omite\n`;
            continue;
        }
        const cols = colsRes.rows.map(c => c.name);
        const data = await db.query(`SELECT * FROM ${t}`);
        out += `\n-- ${t}: ${data.rows.length} filas\n`;
        out += `DELETE FROM ${t};\n`;
        for (const row of data.rows) {
            const vals = cols.map(c => esc(row[c])).join(', ');
            out += `INSERT INTO ${t} (${cols.join(', ')}) VALUES (${vals});\n`;
        }
    }

    out += `COMMIT;\n`;
    fs.writeFileSync(file, out, 'utf8');
    console.log(`✅ Respaldo guardado en ${file}`);
    process.exit(0);
};

run().catch((e) => {
    console.error('❌ Error en respaldo:', e.message);
    process.exit(1);
});
