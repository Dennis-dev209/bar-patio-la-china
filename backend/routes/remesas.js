const express = require('express');
const router = express.Router();
const { db } = require('../config/database');
const { authenticateToken, requireAdmin, logAudit } = require('../middleware/auth');

// ============================================
// GET /api/remesas
// Obtener todas las remesas con filtros
// ============================================
router.get('/', authenticateToken, async (req, res) => {
    try {
        const { remesero_id, ordenante_id, estado, fecha_inicio, fecha_fin, page = 1, limit = 50 } = req.query;

        let query = `
            SELECT 
                rem.*,
                o.nombre as ordenante_nombre,
                r.nombre as remesero_nombre,
                u.nombre as confirmado_por_nombre
            FROM remesas rem
            JOIN ordenantes o ON rem.ordenante_id = o.id
            JOIN remeseros r ON rem.remesero_id = r.id
            LEFT JOIN usuarios u ON rem.confirmado_por = u.id
            WHERE 1=1
        `;
        const params = [];

        // Filtros opcionales
        if (remesero_id) {
            query += ` AND rem.remesero_id = ?`;
            params.push(remesero_id);
        }

        if (ordenante_id) {
            query += ` AND rem.ordenante_id = ?`;
            params.push(ordenante_id);
        }

        if (estado) {
            query += ` AND rem.estado = ?`;
            params.push(estado);
        }

        if (fecha_inicio) {
            query += ` AND rem.fecha_deposito >= ?`;
            params.push(fecha_inicio);
        }

        if (fecha_fin) {
            query += ` AND rem.fecha_deposito <= ?`;
            params.push(fecha_fin);
        }

        // Contar total
        const countResult = await db.query(
            `SELECT COUNT(*) as total FROM (${query})`,
            params
        );
        const total = parseInt(countResult.rows[0].total);

        // Paginación
        const offset = (page - 1) * limit;
        query += ` ORDER BY rem.fecha_deposito DESC, rem.created_at DESC`;
        query += ` LIMIT ? OFFSET ?`;
        params.push(limit, offset);

        const result = await db.query(query, params);

        res.json({
            remesas: result.rows,
            pagination: {
                total,
                page: parseInt(page),
                limit: parseInt(limit),
                pages: Math.ceil(total / limit)
            }
        });

    } catch (error) {
        console.error('Error al obtener remesas:', error);
        res.status(500).json({ error: 'Error al obtener remesas' });
    }
});

// ============================================
// GET /api/remesas/:id
// Obtener una remesa por ID
// ============================================
router.get('/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;

        const result = await db.query(`
            SELECT 
                rem.*,
                o.nombre as ordenante_nombre,
                o.telefono as ordenante_telefono,
                r.nombre as remesero_nombre,
                r.telefono as remesero_telefono,
                u.nombre as confirmado_por_nombre
            FROM remesas rem
            JOIN ordenantes o ON rem.ordenante_id = o.id
            JOIN remeseros r ON rem.remesero_id = r.id
            LEFT JOIN usuarios u ON rem.confirmado_por = u.id
            WHERE rem.id = ?
        `, [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Remesa no encontrada' });
        }

        res.json({ remesa: result.rows[0] });

    } catch (error) {
        console.error('Error al obtener remesa:', error);
        res.status(500).json({ error: 'Error al obtener remesa' });
    }
});

// ============================================
// POST /api/remesas
// Crear nueva remesa (depósito)
// ============================================
router.post('/', authenticateToken, async (req, res) => {
    try {
        const { 
            ordenante_id, 
            remesero_id,
            fecha_deposito, 
            moneda, 
            importe, 
            tasa_cambio, 
            referencia, 
            cantidad_deposito 
        } = req.body;

        // Validar campos requeridos
        if (!ordenante_id || !remesero_id || !fecha_deposito || !moneda || !importe) {
            return res.status(400).json({ 
                error: 'Ordenante, remesero, fecha, moneda e importe son requeridos' 
            });
        }

        // Validar que importe sea positivo
        if (parseFloat(importe) <= 0) {
            return res.status(400).json({ error: 'El importe debe ser mayor a 0' });
        }

        // Validar que tasa_cambio sea positiva (antes del default)
        if (tasa_cambio !== undefined && tasa_cambio !== null && parseFloat(tasa_cambio) <= 0) {
            return res.status(400).json({ error: 'La tasa de cambio debe ser mayor a 0' });
        }

        const tasa = parseFloat(tasa_cambio) || 1.0;

        // Verificar que el ordenante exista
        const ordenanteResult = await db.query(
            'SELECT id, nombre FROM ordenantes WHERE id = ? AND activo = 1',
            [ordenante_id]
        );

        if (ordenanteResult.rows.length === 0) {
            return res.status(404).json({ error: 'Ordenante no encontrado' });
        }

        // Calcular importe CUP
        const importeCUP = parseFloat(importe) * tasa;

        // Crear remesa
        await db.query(
            `INSERT INTO remesas (
                ordenante_id, remesero_id, fecha_deposito, moneda, 
                importe, tasa_cambio, importe_cup, referencia, cantidad_deposito
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                ordenante_id, remesero_id, fecha_deposito, moneda,
                importe, tasa, importeCUP, referencia || null, cantidad_deposito || null
            ]
        );

        // Obtener la remesa creada
        const nuevaRemesa = (await db.query(
            'SELECT * FROM remesas WHERE ordenante_id = ? AND fecha_deposito = ? ORDER BY id DESC LIMIT 1',
            [ordenante_id, fecha_deposito]
        )).rows[0];

        // Registrar auditoría
        logAudit(db, req.user.id, 'crear', 'remesas', nuevaRemesa.id, null, nuevaRemesa, req.ip);

        res.status(201).json({
            message: 'Remesa registrada exitosamente',
            remesa: nuevaRemesa
        });

    } catch (error) {
        console.error('Error al crear remesa:', error);
        res.status(500).json({ error: 'Error al registrar remesa' });
    }
});

// ============================================
// PUT /api/remesas/:id/confirmar
// Confirmar una remesa (conciliación)
// ============================================
router.put('/:id/confirmar', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;

        // Obtener remesa actual
        const anteriorResult = await db.query('SELECT * FROM remesas WHERE id = ?', [id]);
        if (anteriorResult.rows.length === 0) {
            return res.status(404).json({ error: 'Remesa no encontrada' });
        }

        const remesa = anteriorResult.rows[0];

        // Verificar que esté pendiente
        if (remesa.estado === 'confirmado') {
            return res.status(400).json({ error: 'La remesa ya está confirmada' });
        }

        // Confirmar
        await db.query(
            `UPDATE remesas 
             SET estado = 'confirmado', 
                 confirmado_por = ?, 
                 fecha_confirmacion = datetime('now')
             WHERE id = ?`,
            [req.user.id, id]
        );

        // Obtener la remesa actualizada
        const remesaConfirmada = (await db.query('SELECT * FROM remesas WHERE id = ?', [id])).rows[0];

        // Registrar auditoría
        logAudit(db, req.user.id, 'confirmar', 'remesas', id, remesa, remesaConfirmada, req.ip);

        res.json({
            message: 'Remesa confirmada exitosamente',
            remesa: remesaConfirmada
        });

    } catch (error) {
        console.error('Error al confirmar remesa:', error);
        res.status(500).json({ error: 'Error al confirmar remesa' });
    }
});

// ============================================
// PUT /api/remesas/:id/desconfirmar
// Desconfirmar una remesa (volver a pendiente)
// ============================================
router.put('/:id/desconfirmar', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;

        // Obtener remesa actual
        const anteriorResult = await db.query('SELECT * FROM remesas WHERE id = ?', [id]);
        if (anteriorResult.rows.length === 0) {
            return res.status(404).json({ error: 'Remesa no encontrada' });
        }

        const remesa = anteriorResult.rows[0];

        // Verificar que esté confirmada
        if (remesa.estado === 'pendiente') {
            return res.status(400).json({ error: 'La remesa ya está pendiente' });
        }

        // Desconfirmar
        await db.query(
            `UPDATE remesas 
             SET estado = 'pendiente', 
                 confirmado_por = NULL, 
                 fecha_confirmacion = NULL
             WHERE id = ?`,
            [id]
        );

        // Obtener la remesa actualizada
        const remesaActualizada = (await db.query('SELECT * FROM remesas WHERE id = ?', [id])).rows[0];

        // Registrar auditoría
        logAudit(db, req.user.id, 'desconfirmar', 'remesas', id, remesa, remesaActualizada, req.ip);

        res.json({
            message: 'Remesa marcada como pendiente',
            remesa: remesaActualizada
        });

    } catch (error) {
        console.error('Error al desconfirmar remesa:', error);
        res.status(500).json({ error: 'Error al actualizar remesa' });
    }
});

// ============================================
// PUT /api/remesas/:id
// Actualizar remesa
// ============================================
router.put('/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { fecha_deposito, moneda, importe, tasa_cambio, referencia, cantidad_deposito } = req.body;

        // Obtener datos anteriores
        const anteriorResult = await db.query('SELECT * FROM remesas WHERE id = ?', [id]);
        if (anteriorResult.rows.length === 0) {
            return res.status(404).json({ error: 'Remesa no encontrada' });
        }

        // Validar importe positivo si se proporciona
        if (importe !== undefined && parseFloat(importe) <= 0) {
            return res.status(400).json({ error: 'El importe debe ser mayor a 0' });
        }

        // Validar tasa_cambio positiva si se proporciona
        if (tasa_cambio !== undefined && tasa_cambio !== null && parseFloat(tasa_cambio) <= 0) {
            return res.status(400).json({ error: 'La tasa de cambio debe ser mayor a 0' });
        }

        // Recalcular importe CUP si es necesario
        let importeCUP = anteriorResult.rows[0].importe_cup;
        if (importe && tasa_cambio) {
            importeCUP = parseFloat(importe) * parseFloat(tasa_cambio);
        }

        // Actualizar
        await db.query(
            `UPDATE remesas 
             SET fecha_deposito = COALESCE(?, fecha_deposito),
                 moneda = COALESCE(?, moneda),
                 importe = COALESCE(?, importe),
                 tasa_cambio = COALESCE(?, tasa_cambio),
                 importe_cup = ?,
                 referencia = COALESCE(?, referencia),
                 cantidad_deposito = COALESCE(?, cantidad_deposito)
             WHERE id = ?`,
            [fecha_deposito, moneda, importe, tasa_cambio, importeCUP, referencia, cantidad_deposito, id]
        );

        // Obtener la remesa actualizada
        const remesaActualizada = (await db.query('SELECT * FROM remesas WHERE id = ?', [id])).rows[0];

        // Registrar auditoría
        logAudit(db, req.user.id, 'editar', 'remesas', id, anteriorResult.rows[0], remesaActualizada, req.ip);

        res.json({
            message: 'Remesa actualizada exitosamente',
            remesa: remesaActualizada
        });

    } catch (error) {
        console.error('Error al actualizar remesa:', error);
        res.status(500).json({ error: 'Error al actualizar remesa' });
    }
});

// ============================================
// DELETE /api/remesas/:id
// Eliminar remesa
// ============================================
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;

        const anteriorResult = await db.query('SELECT * FROM remesas WHERE id = ?', [id]);
        if (anteriorResult.rows.length === 0) {
            return res.status(404).json({ error: 'Remesa no encontrada' });
        }

        await db.query('DELETE FROM remesas WHERE id = ?', [id]);

        // Registrar auditoría
        logAudit(db, req.user.id, 'eliminar', 'remesas', id, anteriorResult.rows[0], null, req.ip);

        res.json({ message: 'Remesa eliminada exitosamente' });

    } catch (error) {
        console.error('Error al eliminar remesa:', error);
        res.status(500).json({ error: 'Error al eliminar remesa' });
    }
});

// ============================================
// GET /api/remesas/pendientes/count
// Contar remesas pendientes
// ============================================
router.get('/pendientes/count', authenticateToken, async (req, res) => {
    try {
        const result = await db.query(
            `SELECT COUNT(*) as total, COALESCE(SUM(importe_cup), 0) as monto_total
             FROM remesas WHERE estado = 'pendiente'`
        );

        res.json({ pendientes: result.rows[0] });

    } catch (error) {
        console.error('Error al contar pendientes:', error);
        res.status(500).json({ error: 'Error al contar pendientes' });
    }
});

module.exports = router;
