const path = require('path');
const fs = require('fs');
require('dotenv').config();

const DB_PATH = path.join(__dirname, '../../data/database.sqlite');
const TURSO_URL = process.env.DATABASE_URL;

// Crear directorio data si no existe (solo para SQLite local)
if (!TURSO_URL) {
    const dataDir = path.join(__dirname, '../../data');
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }
}

let tursoClient = null;
let sqliteDb = null;

// ============================================
// INICIALIZAR BASE DE DATOS
// ============================================

const initDatabase = async () => {
    // Si hay DATABASE_URL, usar Turso (nube)
    if (TURSO_URL) {
        console.log('☁️  Conectando a Turso (SQLite en la nube)...');
        const { createClient } = require('@libsql/client');
        
        tursoClient = createClient({
            url: TURSO_URL,
            authToken: process.env.TURSO_TOKEN || undefined
        });
        
        // Verificar conexión
        await tursoClient.execute('SELECT 1');
        console.log('✅ Conectado a Turso');
        return tursoClient;
    }
    
    // Si no, usar SQLite local (sql.js)
    console.log('💾 Usando SQLite local...');
    const initSqlJs = require('sql.js');
    const SQL = await initSqlJs();
    
    if (fs.existsSync(DB_PATH)) {
        const fileBuffer = fs.readFileSync(DB_PATH);
        sqliteDb = new SQL.Database(fileBuffer);
    } else {
        sqliteDb = new SQL.Database();
    }
    
    sqliteDb.run("PRAGMA journal_mode = WAL");
    sqliteDb.run("PRAGMA foreign_keys = ON");
    
    return sqliteDb;
};

// ============================================
// EJECUTAR MÚLTIPLES STATEMENTS (para Turso)
// ============================================

// Dividir SQL en statements individuales respetando triggers
function splitSQL(sql) {
    const statements = [];
    let current = '';
    let inTrigger = false;
    let triggerDepth = 0;
    
    const lines = sql.split('\n');
    
    for (const line of lines) {
        const trimmedLine = line.trim();
        
        // Detectar inicio de trigger
        if (trimmedLine.toUpperCase().startsWith('CREATE TRIGGER')) {
            inTrigger = true;
            triggerDepth = 0;
        }
        
        current += line + '\n';
        
        // Contar BEGIN/END en triggers
        if (inTrigger) {
            if (trimmedLine.toUpperCase() === 'BEGIN') triggerDepth++;
            if (trimmedLine.toUpperCase() === 'END;') {
                triggerDepth--;
                if (triggerDepth <= 0) {
                    statements.push(current.trim());
                    current = '';
                    inTrigger = false;
                }
            }
        } else if (trimmedLine.endsWith(';') && !trimmedLine.startsWith('--')) {
            statements.push(current.trim());
            current = '';
        }
    }
    
    if (current.trim().length > 0) {
        statements.push(current.trim());
    }
    
    return statements.filter(s => s.length > 0 && !s.startsWith('--'));
}

async function executeMultipleStatements(text) {
    const statements = splitSQL(text);
    for (const stmt of statements) {
        const cleaned = stmt.replace(/;$/, '').trim();
        if (cleaned.length > 0) {
            await tursoClient.execute({ sql: cleaned, args: [] });
        }
    }
    return { rows: [], rowCount: 0 };
}

// ============================================
// WRAPPER DE BASE DE DATOS (compatibilidad)
// ============================================

const createDbWrapper = () => {
    // Modo Turso
    if (tursoClient) {
        return {
            query: async (text, params = []) => {
                try {
                    // Si es un solo statement con parámetros, ejecutar directo
                    const trimmedSql = text.trim().toUpperCase();
                    const isSingleStatement = trimmedSql.startsWith('SELECT') ||
                        trimmedSql.startsWith('INSERT') ||
                        trimmedSql.startsWith('UPDATE') ||
                        trimmedSql.startsWith('DELETE') ||
                        trimmedSql.startsWith('WITH') ||
                        trimmedSql.startsWith('PRAGMA');
                    
                    if (isSingleStatement || (params && params.length > 0)) {
                        const result = await tursoClient.execute({
                            sql: text,
                            args: params.map(p => p === undefined ? null : p)
                        });
                        return {
                            rows: result.rows,
                            rowCount: result.rows.length
                        };
                    }
                    
                    // Para statements múltiples (schema), usar executeMultiple
                    await tursoClient.executeMultiple(text);
                    return { rows: [], rowCount: 0 };
                } catch (error) {
                    // Si executeMultiple no existe, dividir manualmente
                    if (error.message && error.message.includes('executeMultiple')) {
                        return await executeMultipleStatements(text);
                    }
                    console.error('Error en query (Turso):', error);
                    throw error;
                }
            },
            
            getClient: () => {
                return {
                    query: (text, params) => createDbWrapper().query(text, params),
                    release: () => {}
                };
            },
            
            save: async () => {}, // Turso guarda automáticamente
            
            close: async () => {
                if (tursoClient) {
                    tursoClient.close();
                }
            }
        };
    }
    
    // Modo SQLite local
    return {
        query: (text, params = []) => {
            if (!sqliteDb) {
                throw new Error('Base de datos no inicializada');
            }
            
            try {
                let sql = text;
                let paramIndex = 0;
                sql = sql.replace(/\$\d+/g, () => {
                    return params[paramIndex++] || null;
                });

                params = params.map(p => p === undefined ? null : p);
                
                const trimmedSql = sql.trim().toUpperCase();
                
                if (sql.includes('CREATE TRIGGER') || sql.includes(';') && sql.split(';').filter(s => s.trim()).length > 1) {
                    sqliteDb.exec(sql);
                    return { rows: [], rowCount: 0 };
                }
                
                if (trimmedSql.startsWith('SELECT') || trimmedSql.startsWith('WITH')) {
                    const stmt = sqliteDb.prepare(sql);
                    stmt.bind(params);
                    
                    const rows = [];
                    while (stmt.step()) {
                        rows.push(stmt.getAsObject());
                    }
                    stmt.free();
                    
                    return { rows, rowCount: rows.length };
                } else if (trimmedSql.startsWith('INSERT') && /RETURNING/i.test(sql)) {
                    // INSERT...RETURNING: leer la fila creada directamente
                    // (seguro ante concurrencia, sin SELECT posterior)
                    const stmt = sqliteDb.prepare(sql);
                    stmt.bind(params);
                    const rows = [];
                    while (stmt.step()) {
                        rows.push(stmt.getAsObject());
                    }
                    stmt.free();
                    return { rows, rowCount: rows.length };
                } else if (trimmedSql.startsWith('INSERT')) {
                    sqliteDb.run(sql, params);
                    const lastIdResult = sqliteDb.exec("SELECT last_insert_rowid() as id");
                    const lastId = lastIdResult.length > 0 ? lastIdResult[0].values[0][0] : null;
                    const tableName = getTableName(text);
                    
                    if (tableName && lastId) {
                        const rowResult = sqliteDb.exec(`SELECT * FROM ${tableName} WHERE id = ?`, [lastId]);
                        if (rowResult.length > 0) {
                            const rows = rowResult[0].values.map(r => {
                                const obj = {};
                                rowResult[0].columns.forEach((col, i) => obj[col] = r[i]);
                                return obj;
                            });
                            return { rows, rowCount: 1 };
                        }
                    }
                    return { rows: [], rowCount: 1 };
                } else {
                    sqliteDb.run(sql, params);
                    return { rows: [], rowCount: sqliteDb.getRowsModified() };
                }
            } catch (error) {
                console.error('Error en query:', error);
                throw error;
            }
        },
        
        getClient: () => {
            return {
                query: (text, params) => createDbWrapper().query(text, params),
                release: () => {}
            };
        },
        
        save: saveDatabase,
        
        close: () => {
            saveDatabase();
            if (sqliteDb) {
                sqliteDb.close();
                sqliteDb = null;
            }
        }
    };
};

// ============================================
// FUNCIONES AUXILIARES
// ============================================

function getTableName(sql) {
    const match = sql.match(/INTO\s+(\w+)/i) || sql.match(/UPDATE\s+(\w+)/i) || sql.match(/FROM\s+(\w+)/i);
    return match ? match[1] : null;
}

// Guardar base de datos periódicamente (solo SQLite local)
const saveDatabase = () => {
    if (sqliteDb) {
        try {
            const data = sqliteDb.export();
            const buffer = Buffer.from(data);
            fs.writeFileSync(DB_PATH, buffer);
        } catch (e) {
            console.error('Error al guardar BD:', e);
        }
    }
};

// Solo configurar auto-save para SQLite local
if (!TURSO_URL) {
    setInterval(saveDatabase, 30000);
    
    process.on('SIGINT', () => {
        saveDatabase();
        process.exit(0);
    });

    process.on('SIGTERM', () => {
        saveDatabase();
        process.exit(0);
    });
}

// ============================================
// EXPORTAR
// ============================================

const db = {
    query: (text, params) => createDbWrapper().query(text, params),
    getClient: () => createDbWrapper().getClient(),
    save: () => createDbWrapper().save(),
    close: () => createDbWrapper().close()
};

module.exports = { initDatabase, db };
