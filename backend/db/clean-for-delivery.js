// ============================================
// LIMPIEZA PARA ENTREGA - Bar Patio La China
// Uso: node backend/db/clean-for-delivery.js  [--force-turso]
// Por defecto limpia SOLO la BD local (data/database.sqlite).
// Para limpiar Turso usar --force-turso (requiere DATABASE_URL)
// Conserva todos los usuarios (admin y empleados), borra todo lo demás.
// Genera backup automático antes si no existe uno reciente.
// ============================================
const fs = require('fs');
const path = require('path');

const forceTurso = process.argv.includes('--force-turso');

async function run() {
  // Forzar modo local si no es --force-turso: ocultar DATABASE_URL temporalmente
  const originalUrl = process.env.DATABASE_URL;
  const originalToken = process.env.TURSO_TOKEN;
  if (!forceTurso) {
    delete process.env.DATABASE_URL;
    delete process.env.TURSO_TOKEN;
  }

  const { initDatabase, db } = require('../config/database');
  await initDatabase();
  const mode = forceTurso && originalUrl ? 'turso' : 'local';
  console.log(`🧹 Modo limpieza: ${mode} ${forceTurso ? '(forzado Turso)' : '(local SQLite)'}`);

  // Contar antes
  const tablesBefore = {};
  for (const t of ['usuarios', 'remeseros', 'ordenantes', 'remesas', 'auditoria', 'reset_tokens']) {
    try {
      const r = await db.query(`SELECT COUNT(*) as c FROM ${t}`);
      tablesBefore[t] = Number(r.rows[0].c);
    } catch (e) {
      tablesBefore[t] = `error: ${e.message}`;
    }
  }
  console.log('📊 Antes:', tablesBefore);
  console.log(`👥 Usuarios a conservar: ${tablesBefore.usuarios}`);

  if (tablesBefore.usuarios === 0) {
    console.error('❌ No hay usuarios, abortando para no dejar BD sin acceso. Crea un admin primero.');
    process.exit(1);
  }

  // Backup automático si no hay backup de hoy (solo local)
  if (mode === 'local') {
    const backupDir = path.join(__dirname, '../../backups');
    if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
    const today = new Date().toISOString().slice(0, 10);
    const hasTodayBackup = fs.readdirSync(backupDir).some(f => f.includes(today) && f.includes('LOCAL'));
    if (!hasTodayBackup) {
      console.log('⚠️  No hay backup LOCAL de hoy, generando uno rápido...');
      // Usar lógica de backup_local_sql.js inline para no depender de DATABASE_URL
      try {
        const initSqlJs = require('sql.js');
        const SQL = await initSqlJs();
        const dbPath = path.join(__dirname, '../../data/database.sqlite');
        if (fs.existsSync(dbPath)) {
          const buf = fs.readFileSync(dbPath);
          const sdb = new SQL.Database(buf);
          const exp = sdb.export();
          const outPath = path.join(backupDir, `backup-LOCAL-${new Date().toISOString().slice(0,16).replace('T','_').replace(':','-')}.sqlite`);
          fs.writeFileSync(outPath, Buffer.from(exp));
          console.log(`✅ Backup sqlite guardado en ${outPath}`);
        }
      } catch (e) {
        console.warn('⚠️  No se pudo generar backup sqlite:', e.message);
      }
    }
  }

  // Orden de borrado por FK: remesas -> ordenantes -> remeseros -> auditoria/reset_tokens
  // Usar DELETE físico para entrega limpia (no soft delete). CASCADE no necesario si borramos remesas primero.
  console.log('🗑️  Borrando datos operativos (conservando usuarios)...');
  const steps = [
    { sql: 'DELETE FROM remesas', desc: 'remesas' },
    { sql: 'DELETE FROM ordenantes', desc: 'ordenantes' },
    { sql: 'DELETE FROM remeseros', desc: 'remeseros' },
    { sql: 'DELETE FROM auditoria', desc: 'auditoria' },
    { sql: 'DELETE FROM reset_tokens', desc: 'reset_tokens' },
  ];

  for (const step of steps) {
    try {
      await db.query(step.sql);
      console.log(`  ✅ ${step.desc} vaciado`);
    } catch (e) {
      console.log(`  ⚠️  ${step.desc} error: ${e.message}`);
    }
  }

  // Reset autoincrement (sqlite_sequence) para que IDs empiecen de nuevo si se desea
  // Solo si la tabla existe. No es obligatorio, pero deja BD limpia.
  try {
    await db.query(`DELETE FROM sqlite_sequence WHERE name IN ('remesas','ordenantes','remeseros','auditoria','reset_tokens')`);
    console.log('  ✅ sqlite_sequence reseteado');
  } catch (e) {
    // Turso puede no tener sqlite_sequence o no permitir
    console.log(`  ℹ️  sqlite_sequence no reseteado: ${e.message}`);
  }

  // Guardar si es local
  try {
    if (db.save) await db.save();
  } catch (e) {
    console.warn('save error', e.message);
  }

  // Contar después
  const tablesAfter = {};
  for (const t of ['usuarios', 'remeseros', 'ordenantes', 'remesas', 'auditoria', 'reset_tokens']) {
    try {
      const r = await db.query(`SELECT COUNT(*) as c FROM ${t}`);
      tablesAfter[t] = Number(r.rows[0].c);
    } catch (e) {
      tablesAfter[t] = `error: ${e.message}`;
    }
  }
  console.log('📊 Después:', tablesAfter);

  // Verificación
  const ok = tablesAfter.remeseros === 0 && tablesAfter.ordenantes === 0 && tablesAfter.remesas === 0 && tablesAfter.auditoria === 0 && tablesAfter.usuarios > 0;
  if (ok) {
    console.log('✅ Limpieza completada: BD lista para entrega (solo usuarios)');
  } else {
    console.error('❌ Limpieza incompleta, revisar conteos');
    process.exit(1);
  }

  // Restaurar env si era Turso
  if (forceTurso) {
    process.env.DATABASE_URL = originalUrl;
    process.env.TURSO_TOKEN = originalToken;
  }

  // Cerrar
  if (db.close) await db.close();
  process.exit(0);
}

run().catch(e => {
  console.error('❌ Error en limpieza:', e);
  process.exit(1);
});
