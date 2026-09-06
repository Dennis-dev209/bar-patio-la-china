const express = require('express');
const router = express.Router();
const { db } = require('../config/database');
const { authenticateToken, logAudit } = require('../middleware/auth');

// ============================================
// GET /api/clientes
// Obtener todos los remeseros con resumen
// ============================================
router.get('/', authenticateToken, (req, res) => {
    try {
        const result = db.query(`
            SELECT 
                r.id,
                r.nombre,
                r.telefono,
                r.descripcion,
                r.activo,
                r.created_at,
                COUNT(DISTINCT o.id) as total_ordenantes,
                COALESCE(SUM(CASE WHEN rem.estado = 'pendiente' THEN rem.importe_cup ELSE 0 END), 0) as monto_pendiente,
                COALESCE(SUM(CASE WHEN rem.estado = 'confirmado' THEN rem.importe_cup ELSE 0 END), 0) as monto_confirmado,
                COALESCE(SUM(rem.importe_cup), 0) as monto_total
            FROM remeseros r
            LEFT JOIN ordenantes o ON r.id = o.remesero_id AND o.activo = 1
            LEFT JOIN remesas rem ON r.id = rem.remesero_id
            GROUP BY r.id, r.nombre, r.telefono, r.descripcion, r.activo, r.created_at
            ORDER BY r.nombre ASC
        `);

        res.json({ clientes: result.rows });

    } catch (error) {
        console.error('Error al obtener clientes:', error);
        res.status(500).json({ error: 'Error al obtener clientes' });
    }
});

// ============================================
// GET /api/clientes/:id
// Obtener un remesero por ID con detalles
// ============================================
router.get('/:id', authenticateToken, (req, res) => {
    try {
        const { id } = req.params;

        // Obtener remesero
        const remeseroResult = db.query(
            'SELECT * FROM remeseros WHERE id = ?',
            [id]
        );

        if (remeseroResult.rows.length === 0) {
            return res.status(404).json({ error: 'Cliente no encontrado' });
        }

        const remesero = remeseroResult.rows[0];

        // Obtener estadísticas
        const statsResult = db.query(`
            SELECT 
                COUNT(DISTINCT o.id) as total_ordenantes,
                COUNT(rem.id) as total_remesas,
                COALESCE(SUM(CASE WHEN rem.estado = 'pendiente' THEN rem.importe_cup ELSE 0 END), 0) as monto_pendiente,
                COALESCE(SUM(CASE WHEN rem.estado = 'confirmado' THEN rem.importe_cup ELSE 0 END), 0) as monto_confirmado,
                COALESCE(SUM(rem.importe_cup), 0) as monto_total
            FROM remeseros r
            LEFT JOIN ordenantes o ON r.id = o.remesero_id AND o.activo = 1
            LEFT JOIN remesas rem ON r.id = rem.remesero_id
            WHERE r.id = ?
        `, [id]);

        // Obtener ordenantes recientes
        const ordenantesResult = db.query(`
            SELECT o.id, o.nombre, o.telefono, o.pais_origen,
                   COUNT(rem.id) as total_remesas,
                   COALESCE(SUM(rem.importe_cup), 0) as monto_total
            FROM ordenantes o
            LEFT JOIN remesas rem ON o.id = rem.ordenante_id
            WHERE o.remesero_id = ? AND o.activo = 1
            GROUP BY o.id, o.nombre, o.telefono, o.pais_origen
            ORDER BY o.nombre ASC
            LIMIT 10
        `, [id]);

        res.json({
            cliente: remesero,
            estadisticas: statsResult.rows[0],
            ordenantes: ordenantesResult.rows
        });

    } catch (error) {
        console.error('Error al obtener cliente:', error);
        res.status(500).json({ error: 'Error al obtener cliente' });
    }
});

// ============================================
// POST /api/clientes
// Crear nuevo remesero
// ============================================
router.post('/', authenticateToken, (req, res) => {
    try {
        const { nombre, telefono, descripcion } = req.body;

        // Validar campos
        if (!nombre) {
            return res.status(400).json({ error: 'El nombre es requerido' });
        }

        // Crear remesero
        db.query(
            `INSERT INTO remeseros (nombre, telefono, descripcion) 
             VALUES (?, ?, ?)`,
            [nombre, telefono || null, descripcion || null]
        );

        // Obtener el remesero creado
        const nuevoRemesero = db.query(
            'SELECT * FROM remeseros WHERE nombre = ? ORDER BY id DESC LIMIT 1',
            [nombre]
        ).rows[0];

        // Registrar auditoría
        logAudit(db, req.user.id, 'crear', 'remeseros', nuevoRemesero.id, null, nuevoRemesero, req.ip);

        res.status(201).json({
            message: 'Cliente creado exitosamente',
            cliente: nuevoRemesero
        });

    } catch (error) {
        console.error('Error al crear cliente:', error);
        res.status(500).json({ error: 'Error al crear cliente' });
    }
});

// ============================================
// PUT /api/clientes/:id
// Actualizar remesero
// ============================================
router.put('/:id', authenticateToken, (req, res) => {
    try {
        const { id } = req.params;
        const { nombre, telefono, descripcion, activo } = req.body;

        // Obtener datos anteriores para auditoría
        const anteriorResult = db.query('SELECT * FROM remeseros WHERE id = ?', [id]);
        if (anteriorResult.rows.length === 0) {
            return res.status(404).json({ error: 'Cliente no encontrado' });
        }
        const datosAnteriores = anteriorResult.rows[0];

        // Actualizar
        db.query(
            `UPDATE remeseros 
             SET nombre = COALESCE(?, nombre),
                 telefono = COALESCE(?, telefono),
                 descripcion = COALESCE(?, descripcion),
                 activo = COALESCE(?, activo)
             WHERE id = ?`,
            [nombre, telefono, descripcion, activo, id]
        );

        // Obtener el remesero actualizado
        const remeseroActualizado = db.query('SELECT * FROM remeseros WHERE id = ?', [id]).rows[0];

        // Registrar auditoría
        logAudit(db, req.user.id, 'editar', 'remeseros', id, datosAnteriores, remeseroActualizado, req.ip);

        res.json({
            message: 'Cliente actualizado exitosamente',
            cliente: remeseroActualizado
        });

    } catch (error) {
        console.error('Error al actualizar cliente:', error);
        res.status(500).json({ error: 'Error al actualizar cliente' });
    }
});

// ============================================
// DELETE /api/clientes/:id
// Eliminar remesero (soft delete)
// ============================================
router.delete('/:id', authenticateToken, (req, res) => {
    try {
        const { id } = req.params;

        // Obtener datos antes de eliminar
        const anteriorResult = db.query('SELECT * FROM remeseros WHERE id = ?', [id]);
        if (anteriorResult.rows.length === 0) {
            return res.status(404).json({ error: 'Cliente no encontrado' });
        }

        // Soft delete (marcar como inactivo)
        db.query('UPDATE remeseros SET activo = 0 WHERE id = ?', [id]);

        // También desactivar sus ordenantes
        db.query('UPDATE ordenantes SET activo = 0 WHERE remesero_id = ?', [id]);

        // Registrar auditoría
        logAudit(db, req.user.id, 'eliminar', 'remeseros', id, anteriorResult.rows[0], null, req.ip);

        res.json({ message: 'Cliente eliminado exitosamente' });

    } catch (error) {
        console.error('Error al eliminar cliente:', error);
        res.status(500).json({ error: 'Error al eliminar cliente' });
    }
});

// ============================================
// PUT /api/clientes/:id/restaurar
// Restaurar remesero inactivo
// ============================================
router.put('/:id/restaurar', authenticateToken, (req, res) => {
    try {
        const { id } = req.params;

        db.query(
            'UPDATE remeseros SET activo = 1 WHERE id = ?',
            [id]
        );

        // Obtener el remesero restaurado
        const result = db.query('SELECT * FROM remeseros WHERE id = ?', [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Cliente no encontrado' });
        }

        // Registrar auditoría
        logAudit(db, req.user.id, 'restaurar', 'remeseros', id, null, result.rows[0], req.ip);

        res.json({
            message: 'Cliente restaurado exitosamente',
            cliente: result.rows[0]
        });

    } catch (error) {
        console.error('Error al restaurar cliente:', error);
        res.status(500).json({ error: 'Error al restaurar cliente' });
    }
});

module.exports = router;
