const express = require('express');
const router = express.Router();
const { db } = require('../config/database');
const { authenticateToken, requireAdmin, logAudit } = require('../middleware/auth');
const { parseImporte, parseTasa, parseCantidad, isValidDate, parseMoneda, parseId } = require('../middleware/validation');

// ============================================
// GET /api/ordenantes/remesero/:remeseroId
// Obtener ordenantes de un remesero específico
// ============================================
router.get('/remesero/:remeseroId', authenticateToken, async (req, res) => {
    try {
        const { remeseroId } = req.params;

        const result = await db.query(`
            SELECT 
                o.id,
                o.nombre,
                o.activo,
                o.created_at,
                COUNT(rem.id) as total_remesas,
                COALESCE(SUM(CASE WHEN rem.estado = 'pendiente' THEN rem.importe_cup ELSE 0 END), 0) as monto_pendiente,
                COALESCE(SUM(CASE WHEN rem.estado = 'confirmado' THEN rem.importe_cup ELSE 0 END), 0) as monto_confirmado,
                COALESCE(SUM(rem.importe_cup), 0) as monto_total,
                COALESCE(SUM(CASE WHEN rem.estado = 'pendiente' THEN rem.importe ELSE 0 END), 0) as monto_pendiente_moneda,
                COALESCE(SUM(CASE WHEN rem.estado = 'confirmado' THEN rem.importe ELSE 0 END), 0) as monto_confirmado_moneda,
                COALESCE(SUM(rem.importe), 0) as monto_total_moneda,
                (SELECT rem2.moneda FROM remesas rem2 WHERE rem2.ordenante_id = o.id ORDER BY rem2.created_at DESC LIMIT 1) as ultima_moneda
            FROM ordenantes o
            LEFT JOIN remesas rem ON o.id = rem.ordenante_id
            WHERE o.remesero_id = ? AND o.activo = 1
            GROUP BY o.id, o.nombre, o.activo, o.created_at
            ORDER BY o.nombre ASC
        `, [remeseroId]);

        // Obtener info del remesero
        const remeseroResult = await db.query(
            'SELECT id, nombre FROM remeseros WHERE id = ?',
            [remeseroId]
        );

        res.json({
            remesero: remeseroResult.rows[0] || null,
            ordenantes: result.rows
        });

    } catch (error) {
        console.error('Error al obtener ordenantes:', error);
        res.status(500).json({ error: 'Error al obtener ordenantes' });
    }
});

// ============================================
// GET /api/ordenantes/:id/detalles
// Obtener ordenante con todos sus depósitos
// ============================================
router.get('/:id/detalles', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;

        const ordenanteResult = await db.query(`
            SELECT o.*, r.nombre as remesero_nombre
            FROM ordenantes o
            JOIN remeseros r ON o.remesero_id = r.id
            WHERE o.id = ?
        `, [id]);

        if (ordenanteResult.rows.length === 0) {
            return res.status(404).json({ error: 'Ordenante no encontrado' });
        }

        const ordenante = ordenanteResult.rows[0];

        const depositosResult = await db.query(`
            SELECT 
                rem.*,
                u.nombre as confirmado_por_nombre
            FROM remesas rem
            LEFT JOIN usuarios u ON rem.confirmado_por = u.id
            WHERE rem.ordenante_id = ?
            ORDER BY rem.fecha_deposito DESC, rem.created_at DESC
        `, [id]);

        const statsResult = await db.query(`
            SELECT
                COUNT(*) as total_depositos,
                COALESCE(SUM(CASE WHEN estado = 'pendiente' THEN importe_cup ELSE 0 END), 0) as monto_pendiente,
                COALESCE(SUM(CASE WHEN estado = 'confirmado' THEN importe_cup ELSE 0 END), 0) as monto_confirmado,
                COALESCE(SUM(importe_cup), 0) as monto_total,
                COALESCE(SUM(CASE WHEN estado = 'pendiente' THEN importe ELSE 0 END), 0) as monto_pendiente_moneda,
                COALESCE(SUM(CASE WHEN estado = 'confirmado' THEN importe ELSE 0 END), 0) as monto_confirmado_moneda,
                COALESCE(SUM(importe), 0) as monto_total_moneda,
                (SELECT moneda FROM remesas WHERE ordenante_id = ? ORDER BY created_at DESC LIMIT 1) as ultima_moneda
            FROM remesas
            WHERE ordenante_id = ?
        `, [id, id]);

        res.json({
            ordenante,
            depositos: depositosResult.rows,
            estadisticas: statsResult.rows[0]
        });

    } catch (error) {
        console.error('Error al obtener detalles del ordenante:', error);
        res.status(500).json({ error: 'Error al obtener detalles del ordenante' });
    }
});

// ============================================
// GET /api/ordenantes/:id
// Obtener un ordenante por ID
// ============================================
router.get('/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;

        const ordenanteResult = await db.query(`
            SELECT o.*, r.nombre as remesero_nombre
            FROM ordenantes o
            JOIN remeseros r ON o.remesero_id = r.id
            WHERE o.id = ?
        `, [id]);

        if (ordenanteResult.rows.length === 0) {
            return res.status(404).json({ error: 'Ordenante no encontrado' });
        }

        res.json({ ordenante: ordenanteResult.rows[0] });

    } catch (error) {
        console.error('Error al obtener ordenante:', error);
        res.status(500).json({ error: 'Error al obtener ordenante' });
    }
});

// ============================================
// POST /api/ordenantes
// Crear nuevo ordenante con primer depósito
// ============================================
router.post('/', authenticateToken, async (req, res) => {
    try {
        const { 
            remesero_id, 
            nombre,
            fecha_deposito,
            moneda,
            importe,
            tasa_cambio,
            referencia,
            cantidad_deposito
        } = req.body;

        if (!remesero_id || !nombre) {
            return res.status(400).json({ error: 'Remesero y nombre son requeridos' });
        }

        if (!fecha_deposito || !moneda || !importe) {
            return res.status(400).json({ error: 'Fecha, moneda e importe son requeridos para el primer depósito' });
        }

        // Validar remesero_id entero
        const remeseroIdNum = parseId(remesero_id);
        if (remeseroIdNum === null) {
            return res.status(400).json({ error: 'Remesero inválido' });
        }

        // Validar importe del primer depósito (número mayor a 0, rechaza NaN/texto/negativos)
        const importeNum = parseImporte(importe);
        if (importeNum === null) {
            return res.status(400).json({ error: 'El importe debe ser un número mayor a 0' });
        }

        // Validar fecha real YYYY-MM-DD
        if (!isValidDate(fecha_deposito)) {
            return res.status(400).json({ error: 'La fecha de depósito no es válida (YYYY-MM-DD)' });
        }

        // Validar código de moneda ISO (3 letras)
        const monedaCode = parseMoneda(moneda);
        if (monedaCode === null) {
            return res.status(400).json({ error: 'La moneda no es válida (código de 3 letras)' });
        }

        // Validar tasa si se proporciona (default 1.0)
        let tasa = 1.0;
        if (tasa_cambio !== undefined && tasa_cambio !== null && tasa_cambio !== '') {
            tasa = parseTasa(tasa_cambio);
            if (tasa === null) {
                return res.status(400).json({ error: 'La tasa de cambio debe ser un número mayor a 0' });
            }
        }

        // Si la moneda es CUP, la tasa siempre es 1 (se ignora la enviada)
        if (monedaCode === 'CUP') {
            tasa = 1.0;
        }

        // Validar cantidad_deposito si se proporciona
        let cantidadNum = null;
        if (cantidad_deposito !== undefined && cantidad_deposito !== null && cantidad_deposito !== '') {
            cantidadNum = parseCantidad(cantidad_deposito);
            if (cantidadNum === null) {
                return res.status(400).json({ error: 'La cantidad de depósito no es válida' });
            }
        }

        const remeseroResult = await db.query(
            'SELECT id FROM remeseros WHERE id = ? AND activo = 1',
            [remeseroIdNum]
        );

        if (remeseroResult.rows.length === 0) {
            return res.status(404).json({ error: 'Remesero no encontrado' });
        }

        // Crear ordenante (RETURNING evita confusión ante
        // creaciones concurrentes con el mismo nombre)
        const nuevoOrdenante = (await db.query(
            'INSERT INTO ordenantes (remesero_id, nombre) VALUES (?, ?) RETURNING *',
            [remeseroIdNum, nombre]
        )).rows[0];

        // Crear primer depósito (valores ya validados)
        const importeCUP = importeNum * tasa;

        await db.query(
            `INSERT INTO remesas (ordenante_id, remesero_id, fecha_deposito, moneda, importe, tasa_cambio, importe_cup, referencia, cantidad_deposito) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [nuevoOrdenante.id, remeseroIdNum, fecha_deposito, monedaCode, importeNum, tasa, importeCUP, referencia || null, cantidadNum]
        );

        logAudit(db, req.user.id, 'crear', 'ordenantes', nuevoOrdenante.id, null, nuevoOrdenante, req.ip);

        res.status(201).json({
            message: 'Ordenante creado exitosamente',
            ordenante: nuevoOrdenante
        });

    } catch (error) {
        console.error('Error al crear ordenante:', error);
        res.status(500).json({ error: 'Error al crear ordenante' });
    }
});

// ============================================
// PUT /api/ordenantes/:id
// Editar ordenante (nombre, teléfono, país)
// ============================================
router.put('/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { nombre, telefono, pais_origen } = req.body;

        if (!nombre) {
            return res.status(400).json({ error: 'El nombre es requerido' });
        }

        const anteriorResult = await db.query('SELECT * FROM ordenantes WHERE id = ?', [id]);
        if (anteriorResult.rows.length === 0) {
            return res.status(404).json({ error: 'Ordenante no encontrado' });
        }

        await db.query(
            `UPDATE ordenantes
             SET nombre = ?,
                 telefono = COALESCE(?, telefono),
                 pais_origen = COALESCE(?, pais_origen)
             WHERE id = ?`,
            [nombre, telefono || null, pais_origen || null, id]
        );

        const ordenanteActualizado = (await db.query('SELECT * FROM ordenantes WHERE id = ?', [id])).rows[0];

        logAudit(db, req.user.id, 'editar', 'ordenantes', id, anteriorResult.rows[0], ordenanteActualizado, req.ip);

        res.json({
            message: 'Ordenante actualizado exitosamente',
            ordenante: ordenanteActualizado
        });

    } catch (error) {
        console.error('Error al renombrar ordenante:', error);
        res.status(500).json({ error: 'Error al renombrar ordenante' });
    }
});

// ============================================
// DELETE /api/ordenantes/:id
// Eliminar ordenante (soft delete)
// ============================================
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;

        const anteriorResult = await db.query('SELECT * FROM ordenantes WHERE id = ?', [id]);
        if (anteriorResult.rows.length === 0) {
            return res.status(404).json({ error: 'Ordenante no encontrado' });
        }

        await db.query('UPDATE ordenantes SET activo = 0 WHERE id = ?', [id]);

        logAudit(db, req.user.id, 'eliminar', 'ordenantes', id, anteriorResult.rows[0], null, req.ip);

        res.json({ message: 'Ordenante eliminado exitosamente' });

    } catch (error) {
        console.error('Error al eliminar ordenante:', error);
        res.status(500).json({ error: 'Error al eliminar ordenante' });
    }
});

module.exports = router;
