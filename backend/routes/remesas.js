const express = require('express');
const router = express.Router();
const { db } = require('../config/database');
const { authenticateToken, requireAdmin, logAudit } = require('../middleware/auth');
const { parseImporte, parseTasa, parseCantidad, isValidDate, parseMoneda, parseId, parsePagination, ESTADOS_VALIDOS } = require('../middleware/validation');

// ============================================
// GET /api/remesas
// Obtener todas las remesas con filtros
// ============================================
router.get('/', authenticateToken, async (req, res) => {
    try {
        const { remesero_id, ordenante_id, estado, fecha_inicio, fecha_fin, page = 1, limit = 50 } = req.query;

        // Paginación segura: limit máximo 100, page >= 1
        const { page: safePage, limit: safeLimit, offset } = parsePagination(page, limit, 100);

        // Estado contra lista cerrada
        if (estado && !ESTADOS_VALIDOS.includes(estado)) {
            return res.status(400).json({ error: 'Estado no válido' });
        }

        // Fechas con formato válido si se proporcionan
        if ((fecha_inicio && !isValidDate(fecha_inicio)) || (fecha_fin && !isValidDate(fecha_fin))) {
            return res.status(400).json({ error: 'Fecha no válida (YYYY-MM-DD)' });
        }

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

        // Paginación (valores ya saneados)
        query += ` ORDER BY rem.fecha_deposito DESC, rem.created_at DESC`;
        query += ` LIMIT ? OFFSET ?`;
        params.push(safeLimit, offset);

        const result = await db.query(query, params);

        res.json({
            remesas: result.rows,
            pagination: {
                total,
                page: safePage,
                limit: safeLimit,
                pages: Math.ceil(total / safeLimit)
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

        // Validar IDs enteros
        const ordenanteIdNum = parseId(ordenante_id);
        const remeseroIdNum = parseId(remesero_id);
        if (ordenanteIdNum === null || remeseroIdNum === null) {
            return res.status(400).json({ error: 'Ordenante o remesero inválido' });
        }

        // Validar que importe sea un número mayor a 0 (rechaza NaN, texto, negativos)
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

        // Solo se acepta EUR para nuevos depósitos
        if (monedaCode !== 'EUR') {
            return res.status(400).json({ error: 'Solo se acepta EUR para nuevos depósitos' });
        }

        // Validar que tasa_cambio sea positiva si se proporciona (antes del default)
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

        // Verificar que el ordenante exista
        const ordenanteResult = await db.query(
            'SELECT id, nombre FROM ordenantes WHERE id = ? AND activo = 1',
            [ordenanteIdNum]
        );

        if (ordenanteResult.rows.length === 0) {
            return res.status(404).json({ error: 'Ordenante no encontrado' });
        }

        // Calcular importe CUP
        const importeCUP = importeNum * tasa;

        // Crear remesa (RETURNING devuelve la fila exacta creada)
        const nuevaRemesa = (await db.query(
            `INSERT INTO remesas (
                ordenante_id, remesero_id, fecha_deposito, moneda,
                importe, tasa_cambio, importe_cup, referencia, cantidad_deposito
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *`,
            [
                ordenanteIdNum, remeseroIdNum, fecha_deposito, monedaCode,
                importeNum, tasa, importeCUP, referencia || null, cantidadNum
            ]
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

        // Validar importe si se proporciona (número mayor a 0, rechaza NaN/texto)
        let importeNum;
        if (importe !== undefined && importe !== null && importe !== '') {
            importeNum = parseImporte(importe);
            if (importeNum === null) {
                return res.status(400).json({ error: 'El importe debe ser un número mayor a 0' });
            }
        }

        // Validar tasa_cambio si se proporciona
        let tasaNum;
        if (tasa_cambio !== undefined && tasa_cambio !== null && tasa_cambio !== '') {
            tasaNum = parseTasa(tasa_cambio);
            if (tasaNum === null) {
                return res.status(400).json({ error: 'La tasa de cambio debe ser un número mayor a 0' });
            }
        }

        // Validar fecha si se proporciona
        if (fecha_deposito !== undefined && fecha_deposito !== null && fecha_deposito !== '' && !isValidDate(fecha_deposito)) {
            return res.status(400).json({ error: 'La fecha de depósito no es válida (YYYY-MM-DD)' });
        }

        // Validar moneda si se proporciona
        let monedaCode;
        if (moneda !== undefined && moneda !== null && moneda !== '') {
            monedaCode = parseMoneda(moneda);
            if (monedaCode === null) {
                return res.status(400).json({ error: 'La moneda no es válida (código de 3 letras)' });
            }
        }

        // Validar cantidad_deposito si se proporciona
        let cantidadNum;
        if (cantidad_deposito !== undefined && cantidad_deposito !== null && cantidad_deposito !== '') {
            cantidadNum = parseCantidad(cantidad_deposito);
            if (cantidadNum === null) {
                return res.status(400).json({ error: 'La cantidad de depósito no es válida' });
            }
        }

        // Recalcular importe CUP si cambió importe o tasa (usa valores actuales como base)
        const anterior = anteriorResult.rows[0];
        // Si la moneda final es CUP, la tasa siempre es 1
        const monedaFinal = monedaCode || anterior.moneda;
        if (monedaFinal === 'CUP') {
            tasaNum = 1.0;
        }
        let importeCUP = anterior.importe_cup;
        if (importeNum !== undefined || tasaNum !== undefined) {
            const importeFinal = importeNum !== undefined ? importeNum : Number(anterior.importe);
            const tasaFinal = tasaNum !== undefined ? tasaNum : Number(anterior.tasa_cambio);
            if (Number.isFinite(importeFinal) && Number.isFinite(tasaFinal)) {
                importeCUP = importeFinal * tasaFinal;
            }
        }

        // Actualizar (solo valores validados; undefined conserva el valor actual)
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
            [fecha_deposito || null, monedaCode || null, importeNum || null, tasaNum || null, importeCUP, referencia || null, (cantidadNum === undefined ? null : cantidadNum), id]
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
