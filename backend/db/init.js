const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { initDatabase, db } = require('../config/database');

const initDB = async () => {
    try {
        console.log('🔧 Inicializando base de datos...');
        
        // Inicializar SQLite
        await initDatabase();
        
        // Leer y ejecutar schema.sql
        const schemaPath = path.join(__dirname, 'schema.sql');
        const schema = fs.readFileSync(schemaPath, 'utf8');
        
        // Ejecutar cada statement por separado
        const statements = schema.split(';').filter(s => s.trim());
        
        for (const statement of statements) {
            if (statement.trim()) {
                db.query(statement);
            }
        }
        console.log('✅ Tablas creadas correctamente');
        
        // Generar hash de contraseña para usuarios de prueba
        const salt = bcrypt.genSaltSync(10);
        const passwordHash = bcrypt.hashSync('admin123', salt);
        
        // Insertar usuario admin si no existe
        const adminExists = db.query(
            "SELECT id FROM usuarios WHERE email = 'admin@patiolachina.com'"
        );
        
        if (adminExists.rows.length === 0) {
            db.query(
                `INSERT INTO usuarios (nombre, email, password_hash, rol) 
                 VALUES (?, ?, ?, ?)`,
                ['Administrador', 'admin@patiolachina.com', passwordHash, 'admin']
            );
            console.log('✅ Usuario admin creado (admin@patiolachina.com / admin123)');
        } else {
            console.log('ℹ️  Usuario admin ya existe');
        }
        
        // Insertar empleados de prueba si no existen
        const empleadosExistent = db.query(
            "SELECT COUNT(*) as count FROM usuarios WHERE email LIKE '%@patiolachina.com'"
        );
        
        if (parseInt(empleadosExistent.rows[0].count) < 3) {
            const empleados = [
                ['Empleado 1', 'empleado1@patiolachina.com', passwordHash, 'empleado'],
                ['Empleado 2', 'empleado2@patiolachina.com', passwordHash, 'empleado']
            ];
            
            for (const emp of empleados) {
                const exists = db.query(
                    "SELECT id FROM usuarios WHERE email = ?",
                    [emp[1]]
                );
                
                if (exists.rows.length === 0) {
                    db.query(
                        `INSERT INTO usuarios (nombre, email, password_hash, rol) 
                         VALUES (?, ?, ?, ?)`,
                        emp
                    );
                }
            }
            console.log('✅ Usuarios de prueba creados');
        }
        
        // Guardar cambios
        db.save();
        
        console.log('\n🎉 Base de datos inicializada correctamente');
        console.log('\n📋 Credenciales de acceso:');
        console.log('   Admin: admin@patiolachina.com / admin123');
        console.log('   Empleado 1: empleado1@patiolachina.com / admin123');
        console.log('   Empleado 2: empleado2@patiolachina.com / admin123');
        
        process.exit(0);
        
    } catch (error) {
        console.error('❌ Error al inicializar base de datos:', error);
        process.exit(1);
    }
};

// Ejecutar si se llama directamente
if (require.main === module) {
    initDB();
}

module.exports = initDB;
