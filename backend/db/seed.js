const fs = require('fs');
const path = require('path');
const db = require('../config/database');
require('dotenv').config();

const seedDatabase = async () => {
    try {
        console.log('🌱 Poblando base de datos con datos de prueba...');
        
        // Verificar si ya hay datos
        const clientesCount = await db.query('SELECT COUNT(*) FROM remeseros');
        
        if (parseInt(clientesCount.rows[0].count) > 0) {
            console.log('ℹ️  Ya existen datos en la base de datos');
            const answer = prompt('¿Deseas continuar y agregar más datos? (s/n): ');
            if (answer.toLowerCase() !== 's') {
                process.exit(0);
            }
        }
        
        // Insertar remeseros
        const remeseros = [
            ['Juan Pérez', '+53 5555 1234', 'Cliente frecuente, envía mensualmente'],
            ['María García', '+53 5555 5678', 'Cliente preferente'],
            ['Carlos Rodríguez', '+53 5555 9012', 'Nuevo cliente'],
            ['Ana Martínez', '+53 5555 3456', 'Cliente desde 2024'],
            ['Roberto Sánchez', '+53 5555 7890', 'Cliente corporativo']
        ];
        
        for (const remesero of remeseros) {
            const exists = await db.query(
                'SELECT id FROM remeseros WHERE nombre = $1',
                [remesero[0]]
            );
            
            if (exists.rows.length === 0) {
                await db.query(
                    'INSERT INTO remeseros (nombre, telefono, descripcion) VALUES ($1, $2, $3)',
                    remesero
                );
            }
        }
        console.log('✅ Remeseros insertados');
        
        // Insertar ordenantes
        const ordenantes = [
            [1, 'Pedro López', '+1 305 555 1111', 'Estados Unidos'],
            [1, 'Luis Hernández', '+1 305 555 2222', 'Estados Unidos'],
            [1, 'Miguel Torres', '+34 612 345 678', 'España'],
            [2, 'Fernando Díaz', '+1 786 555 3333', 'Estados Unidos'],
            [2, 'Sandra Morales', '+34 623 456 789', 'España'],
            [3, 'José Gómez', '+1 713 555 4444', 'Estados Unidos'],
            [4, 'Ricardo Vargas', '+52 55 1234 5678', 'México'],
            [4, 'Patricia Romero', '+52 55 9876 5432', 'México'],
            [4, 'Eduardo Silva', '+1 212 555 5555', 'Estados Unidos'],
            [5, 'Francisco Castro', '+57 310 555 6666', 'Colombia'],
            [5, 'Lucía Fernández', '+54 11 5555 7777', 'Argentina']
        ];
        
        for (const ordenante of ordenantes) {
            const exists = await db.query(
                'SELECT id FROM ordenantes WHERE nombre = $1 AND remesero_id = $2',
                [ordenante[1], ordenante[0]]
            );
            
            if (exists.rows.length === 0) {
                await db.query(
                    'INSERT INTO ordenantes (remesero_id, nombre, telefono, pais_origen) VALUES ($1, $2, $3, $4)',
                    ordenante
                );
            }
        }
        console.log('✅ Ordenantes insertados');
        
        // Insertar remesas
        const remesas = [
            [1, 1, '2026-09-01', 'USD', 500.00, 120.00, 60000.00, 'REF-001', 'confirmado'],
            [1, 1, '2026-09-05', 'USD', 300.00, 120.00, 36000.00, 'REF-002', 'confirmado'],
            [1, 1, '2026-09-10', 'USD', 750.00, 120.00, 90000.00, 'REF-003', 'pendiente'],
            [2, 1, '2026-09-03', 'USD', 200.00, 120.00, 24000.00, 'REF-004', 'confirmado'],
            [2, 1, '2026-09-08', 'EUR', 400.00, 130.00, 52000.00, 'REF-005', 'pendiente'],
            [3, 1, '2026-09-12', 'EUR', 600.00, 130.00, 78000.00, 'REF-006', 'pendiente'],
            [4, 2, '2026-09-02', 'USD', 1000.00, 120.00, 120000.00, 'REF-007', 'confirmado'],
            [4, 2, '2026-09-07', 'USD', 800.00, 120.00, 96000.00, 'REF-008', 'confirmado'],
            [5, 2, '2026-09-11', 'EUR', 350.00, 130.00, 45500.00, 'REF-009', 'pendiente'],
            [6, 3, '2026-09-04', 'USD', 450.00, 120.00, 54000.00, 'REF-010', 'confirmado'],
            [6, 3, '2026-09-09', 'USD', 250.00, 120.00, 30000.00, 'REF-011', 'pendiente'],
            [7, 4, '2026-09-06', 'MXN', 15000.00, 7.00, 105000.00, 'REF-012', 'confirmado'],
            [7, 4, '2026-09-13', 'MXN', 8000.00, 7.00, 56000.00, 'REF-013', 'pendiente'],
            [8, 4, '2026-09-14', 'MXN', 12000.00, 7.00, 84000.00, 'REF-014', 'pendiente'],
            [9, 4, '2026-09-15', 'USD', 600.00, 120.00, 72000.00, 'REF-015', 'pendiente'],
            [10, 5, '2026-09-16', 'COP', 2000000.00, 0.0003, 60000.00, 'REF-016', 'pendiente'],
            [11, 5, '2026-09-17', 'ARS', 150000.00, 0.40, 60000.00, 'REF-017', 'pendiente']
        ];
        
        for (const remesa of remesas) {
            const exists = await db.query(
                'SELECT id FROM remesas WHERE referencia = $1',
                [remesa[7]]
            );
            
            if (exists.rows.length === 0) {
                await db.query(
                    `INSERT INTO remesas (ordenante_id, remesero_id, fecha_deposito, moneda, importe, tasa_cambio, importe_cup, referencia, estado) 
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
                    remesa
                );
            }
        }
        console.log('✅ Remesas insertadas');
        
        // Actualizar confirmaciones
        await db.query(`
            UPDATE remesas 
            SET confirmado_por = 1, 
                fecha_confirmacion = created_at + INTERVAL '1 hour'
            WHERE estado = 'confirmado' AND confirmado_por IS NULL
        `);
        console.log('✅ Confirmaciones actualizadas');
        
        console.log('\n🎉 Base de datos poblada exitosamente');
        console.log('\n📊 Resumen:');
        
        const stats = await db.query(`
            SELECT 
                (SELECT COUNT(*) FROM remeseros) as remeseros,
                (SELECT COUNT(*) FROM ordenantes) as ordenantes,
                (SELECT COUNT(*) FROM remesas) as remesas,
                (SELECT COUNT(*) FROM remesas WHERE estado = 'pendiente') as pendientes,
                (SELECT COUNT(*) FROM remesas WHERE estado = 'confirmado') as confirmadas
        `);
        
        console.log(`   Remeseros: ${stats.rows[0].remeseros}`);
        console.log(`   Ordenantes: ${stats.rows[0].ordenantes}`);
        console.log(`   Remesas: ${stats.rows[0].remesas}`);
        console.log(`   Pendientes: ${stats.rows[0].pendientes}`);
        console.log(`   Confirmadas: ${stats.rows[0].confirmadas}`);
        
        process.exit(0);
        
    } catch (error) {
        console.error('❌ Error al poblar base de datos:', error);
        process.exit(1);
    }
};

// Ejecutar si se llama directamente
if (require.main === module) {
    seedDatabase();
}

module.exports = seedDatabase;
