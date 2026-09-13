const express = require('express');
const router = express.Router();
const { db } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

// ============================================
// GET /api/reportes/resumen
// Resumen general del sistema
// ============================================
router.get('/resumen', authenticateToken, async (req, res) => {
    try {
        const result = await db.query(`
            SELECT 
                COUNT(DISTINCT r.id) as total_remeseros,
                COUNT(DISTINCT o.id) as total_ordenantes,
                COUNT(rem.id) as total_remesas,
                COALESCE(SUM(CASE WHEN rem.estado = 'pendiente' THEN rem.importe_cup ELSE 0 END), 0) as monto_pendiente,
                COALESCE(SUM(CASE WHEN rem.estado = 'confirmado' THEN rem.importe_cup ELSE 0 END), 0) as monto_confirmado,
                COALESCE(SUM(rem.importe_cup), 0) as monto_total,
                COUNT(CASE WHEN rem.estado = 'pendiente' THEN 1 END) as remesas_pendientes,
                COUNT(CASE WHEN rem.estado = 'confirmado' THEN 1 END) as remesas_confirmadas
            FROM remeseros r
            LEFT JOIN ordenantes o ON r.id = o.remesero_id AND o.activo = 1
            LEFT JOIN remesas rem ON o.id = rem.ordenante_id
            WHERE r.activo = 1
        `);

        // Desglose por moneda extranjera (importe sin convertir).
        // Se agrupa directo desde remesas para no duplicar filas.
        const porMoneda = await db.query(`
            SELECT
                rem.moneda as moneda,
                COUNT(*) as total_remesas,
                COALESCE(SUM(CASE WHEN rem.estado = 'pendiente' THEN rem.importe ELSE 0 END), 0) as monto_pendiente,
                COALESCE(SUM(CASE WHEN rem.estado = 'confirmado' THEN rem.importe ELSE 0 END), 0) as monto_confirmado,
                COALESCE(SUM(rem.importe), 0) as monto_total,
                COUNT(CASE WHEN rem.estado = 'pendiente' THEN 1 END) as pendientes,
                COUNT(CASE WHEN rem.estado = 'confirmado' THEN 1 END) as confirmadas
            FROM remesas rem
            JOIN ordenantes o ON rem.ordenante_id = o.id AND o.activo = 1
            JOIN remeseros r ON rem.remesero_id = r.id AND r.activo = 1
            GROUP BY rem.moneda
            ORDER BY monto_total DESC
        `);

        res.json({ resumen: result.rows[0], por_moneda: porMoneda.rows });

    } catch (error) {
        console.error('Error al obtener resumen:', error);
        res.status(500).json({ error: 'Error al obtener resumen' });
    }
});

// ============================================
// GET /api/reportes/por-periodo
// Reporte por período (diario, mensual, anual)
// ============================================
router.get('/por-periodo', authenticateToken, async (req, res) => {
    try {
        const { tipo = 'mensual', fecha_inicio, fecha_fin } = req.query;

        let groupBy, dateFormat;

        switch (tipo) {
            case 'diario':
                groupBy = "DATE(rem.fecha_deposito)";
                dateFormat = '%Y-%m-%d';
                break;
            case 'mensual':
                groupBy = "strftime('%Y-%m', rem.fecha_deposito)";
                dateFormat = '%Y-%m';
                break;
            case 'anual':
                groupBy = "strftime('%Y', rem.fecha_deposito)";
                dateFormat = '%Y';
                break;
            default:
                groupBy = "strftime('%Y-%m', rem.fecha_deposito)";
                dateFormat = '%Y-%m';
        }

        // Montos en moneda extranjera (importe sin convertir), una fila por moneda
        let query = `
            SELECT
                ${groupBy} as periodo,
                rem.moneda as moneda,
                COUNT(*) as total_remesas,
                COALESCE(SUM(CASE WHEN estado = 'pendiente' THEN importe ELSE 0 END), 0) as monto_pendiente,
                COALESCE(SUM(CASE WHEN estado = 'confirmado' THEN importe ELSE 0 END), 0) as monto_confirmado,
                COALESCE(SUM(importe), 0) as monto_total,
                COUNT(CASE WHEN estado = 'pendiente' THEN 1 END) as pendientes,
                COUNT(CASE WHEN estado = 'confirmado' THEN 1 END) as confirmadas
            FROM remesas rem
            JOIN ordenantes o ON rem.ordenante_id = o.id AND o.activo = 1
            JOIN remeseros r ON rem.remesero_id = r.id AND r.activo = 1
            WHERE 1=1
        `;
        const params = [];

        if (fecha_inicio) {
            query += ` AND rem.fecha_deposito >= ?`;
            params.push(fecha_inicio);
        }

        if (fecha_fin) {
            query += ` AND rem.fecha_deposito <= ?`;
            params.push(fecha_fin);
        }

        query += ` GROUP BY ${groupBy}, rem.moneda ORDER BY periodo DESC, rem.moneda ASC`;

        const result = await db.query(query, params);

        res.json({ reporte: result.rows });

    } catch (error) {
        console.error('Error al obtener reporte por período:', error);
        res.status(500).json({ error: 'Error al obtener reporte' });
    }
});

// ============================================
// GET /api/reportes/por-remesero
// Reporte por remesero
// ============================================
router.get('/por-remesero', authenticateToken, async (req, res) => {
    try {
        const { fecha_inicio, fecha_fin } = req.query;

        // Montos en moneda extranjera (importe sin convertir), una fila por moneda
        let query = `
            SELECT
                r.id,
                r.nombre,
                rem.moneda as moneda,
                COUNT(rem.id) as total_remesas,
                COALESCE(SUM(CASE WHEN rem.estado = 'pendiente' THEN rem.importe ELSE 0 END), 0) as monto_pendiente,
                COALESCE(SUM(CASE WHEN rem.estado = 'confirmado' THEN rem.importe ELSE 0 END), 0) as monto_confirmado,
                COALESCE(SUM(rem.importe), 0) as monto_total,
                COUNT(CASE WHEN rem.estado = 'pendiente' THEN 1 END) as pendientes,
                COUNT(CASE WHEN rem.estado = 'confirmado' THEN 1 END) as confirmadas
            FROM remeseros r
            LEFT JOIN remesas rem ON r.id = rem.remesero_id
        `;
        // Solo remeseros activos (los eliminados no aparecen en reportes)
        const conditions = ['r.activo = 1'];
        const params = [];

        if (fecha_inicio) {
            conditions.push(`rem.fecha_deposito >= ?`);
            params.push(fecha_inicio);
        }

        if (fecha_fin) {
            conditions.push(`rem.fecha_deposito <= ?`);
            params.push(fecha_fin);
        }

        if (conditions.length > 0) {
            query += ` WHERE ${conditions.join(' AND ')}`;
        }

        query += ` GROUP BY r.id, r.nombre, rem.moneda ORDER BY monto_total DESC`;

        const result = await db.query(query, params);

        res.json({ reporte: result.rows });

    } catch (error) {
        console.error('Error al obtener reporte por remesero:', error);
        res.status(500).json({ error: 'Error al obtener reporte' });
    }
});

// ============================================
// GET /api/reportes/pendientes
// Lista de remesas pendientes
// ============================================
router.get('/pendientes', authenticateToken, async (req, res) => {
    try {
        const result = await db.query(`
            SELECT 
                rem.*,
                o.nombre as ordenante_nombre,
                r.nombre as remesero_nombre
            FROM remesas rem
            JOIN ordenantes o ON rem.ordenante_id = o.id
            JOIN remeseros r ON rem.remesero_id = r.id
            WHERE rem.estado = 'pendiente'
            ORDER BY rem.fecha_deposito ASC
        `);

        // Calcular totales (desglose por moneda extranjera para el badge)
        const totales = await db.query(`
            SELECT
                COUNT(*) as cantidad,
                COALESCE(SUM(importe_cup), 0) as monto_total
            FROM remesas
            WHERE estado = 'pendiente'
        `);

        const totalesMoneda = await db.query(`
            SELECT
                moneda,
                COUNT(*) as cantidad,
                COALESCE(SUM(importe), 0) as monto_total
            FROM remesas
            WHERE estado = 'pendiente'
            GROUP BY moneda
        `);

        res.json({
            pendientes: result.rows,
            totales: totales.rows[0],
            totales_por_moneda: totalesMoneda.rows
        });

    } catch (error) {
        console.error('Error al obtener pendientes:', error);
        res.status(500).json({ error: 'Error al obtener pendientes' });
    }
});

// ============================================
// GET /api/reportes/buscar?q=nombre
// Buscador global: clientes y ordenantes por inicial (nombres solamente)
// ============================================
router.get('/buscar', authenticateToken, async (req, res) => {
    try {
        const q = (req.query.q || '').trim();

        if (q.length < 2) {
            return res.status(400).json({ error: 'Escribe al menos 2 letras para buscar' });
        }

        // Escapar comodines del LIKE para que se busquen literales
        const like = `${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

        const cliResult = await db.query(`
            SELECT id, nombre
            FROM remeseros
            WHERE activo = 1 AND nombre LIKE ? ESCAPE '\\'
            ORDER BY nombre ASC
            LIMIT 8
        `, [like]);

        const ordResult = await db.query(`
            SELECT o.id, o.nombre, o.remesero_id, r.nombre as remesero_nombre
            FROM ordenantes o
            JOIN remeseros r ON o.remesero_id = r.id
            WHERE o.activo = 1 AND r.activo = 1 AND o.nombre LIKE ? ESCAPE '\\'
            ORDER BY o.nombre ASC
            LIMIT 8
        `, [like]);

        res.json({ clientes: cliResult.rows, ordenantes: ordResult.rows });

    } catch (error) {
        console.error('Error en buscador global:', error);
        res.status(500).json({ error: 'Error al buscar' });
    }
});

// ============================================
// GET /api/reportes/historial-remesero/:id
// Historial completo de un remesero
// ============================================
router.get('/historial-remesero/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { fecha_inicio, fecha_fin } = req.query;

        // Info del remesero
        const remeseroResult = await db.query(
            'SELECT * FROM remeseros WHERE id = ?',
            [id]
        );

        if (remeseroResult.rows.length === 0) {
            return res.status(404).json({ error: 'Remesero no encontrado' });
        }

        let query = `
            SELECT 
                rem.*,
                o.nombre as ordenante_nombre
            FROM remesas rem
            JOIN ordenantes o ON rem.ordenante_id = o.id
            WHERE rem.remesero_id = ?
        `;
        const params = [id];

        if (fecha_inicio) {
            query += ` AND rem.fecha_deposito >= ?`;
            params.push(fecha_inicio);
        }

        if (fecha_fin) {
            query += ` AND rem.fecha_deposito <= ?`;
            params.push(fecha_fin);
        }

        query += ` ORDER BY rem.fecha_deposito DESC`;

        const remesasResult = await db.query(query, params);

        // Estadísticas
        const statsResult = await db.query(`
            SELECT 
                COUNT(*) as total,
                COALESCE(SUM(CASE WHEN estado = 'pendiente' THEN importe_cup ELSE 0 END), 0) as pendiente,
                COALESCE(SUM(CASE WHEN estado = 'confirmado' THEN importe_cup ELSE 0 END), 0) as confirmado,
                COALESCE(SUM(importe_cup), 0) as total_monto
            FROM remesas
            WHERE remesero_id = ?
        `, [id]);

        res.json({
            remesero: remeseroResult.rows[0],
            remesas: remesasResult.rows,
            estadisticas: statsResult.rows[0]
        });

    } catch (error) {
        console.error('Error al obtener historial:', error);
        res.status(500).json({ error: 'Error al obtener historial' });
    }
});

// ============================================
// GET /api/reportes/historial-ordenante/:id
// Historial completo de un ordenante
// ============================================
router.get('/historial-ordenante/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;

        // Info del ordenante
        const ordenanteResult = await db.query(`
            SELECT o.*, r.nombre as remesero_nombre
            FROM ordenantes o
            JOIN remeseros r ON o.remesero_id = r.id
            WHERE o.id = ?
        `, [id]);

        if (ordenanteResult.rows.length === 0) {
            return res.status(404).json({ error: 'Ordenante no encontrado' });
        }

        const remesasResult = await db.query(`
            SELECT * FROM remesas
            WHERE ordenante_id = ?
            ORDER BY fecha_deposito DESC
        `, [id]);

        const statsResult = await db.query(`
            SELECT 
                COUNT(*) as total,
                COALESCE(SUM(CASE WHEN estado = 'pendiente' THEN importe_cup ELSE 0 END), 0) as pendiente,
                COALESCE(SUM(CASE WHEN estado = 'confirmado' THEN importe_cup ELSE 0 END), 0) as confirmado,
                COALESCE(SUM(importe_cup), 0) as total_monto
            FROM remesas
            WHERE ordenante_id = ?
        `, [id]);

        res.json({
            ordenante: ordenanteResult.rows[0],
            remesas: remesasResult.rows,
            estadisticas: statsResult.rows[0]
        });

    } catch (error) {
        console.error('Error al obtener historial:', error);
        res.status(500).json({ error: 'Error al obtener historial' });
    }
});

module.exports = router;

// ============================================
// GET /api/reportes/auditoria
// Registro de actividad (solo admin)
// Filtros: pagina, limite, accion, tabla, fecha_desde, fecha_hasta
// Últimos 15 días por defecto, acciones: crear, editar, eliminar, confirmar, desconfirmar, restaurar, cambiar_contraseña
// ============================================
router.get('/auditoria', authenticateToken, async (req, res) => {
    try {
        const { 
            pagina = 1, 
            limite = 50, 
            accion, 
            tabla, 
            fecha_desde, 
            fecha_hasta,
            usuario_id,
            q
        } = req.query;

        const page = Math.max(1, parseInt(pagina) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(limite) || 50));
        const offset = (page - 1) * limit;

        // Acciones permitidas para filtrar (las que pidió el cliente)
        const accionesPermitidas = ['crear', 'editar', 'eliminar', 'confirmar', 'desconfirmar', 'restaurar', 'cambiar_contraseña'];
        
        let whereConditions = [];
        const params = [];

        // Por defecto últimos 15 días
        const fechaDesdeDefault = new Date();
        fechaDesdeDefault.setDate(fechaDesdeDefault.getDate() - 15);
        const fechaDesdeDefaultStr = fechaDesdeDefault.toISOString().split('T')[0];

        if (fecha_desde) {
            whereConditions.push(`a.created_at >= ?`);
            params.push(fecha_desde);
        } else {
            whereConditions.push(`a.created_at >= ?`);
            params.push(fechaDesdeDefaultStr);
        }

        if (fecha_hasta) {
            whereConditions.push(`a.created_at <= ?`);
            params.push(fecha_hasta);
        }

        if (accion && accionesPermitidas.includes(accion)) {
            whereConditions.push(`a.accion = ?`);
            params.push(accion);
        }

        if (tabla) {
            whereConditions.push(`a.tabla = ?`);
            params.push(tabla);
        }

        if (usuario_id) {
            whereConditions.push(`a.usuario_id = ?`);
            params.push(usuario_id);
        }

        // Búsqueda libre en usuario, acción y tabla (por inicial)
        if (q && q.trim().length >= 2) {
            const like = `${q.trim().replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
            whereConditions.push(`(u.nombre LIKE ? ESCAPE '\\' OR a.accion LIKE ? ESCAPE '\\' OR a.tabla LIKE ? ESCAPE '\\')`);
            params.push(like, like, like);
        }

        const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

        // Total de registros (mismo JOIN que datos, por el filtro q sobre usuarios)
        const countResult = await db.query(
            `SELECT COUNT(*) as total FROM auditoria a LEFT JOIN usuarios u ON a.usuario_id = u.id ${whereClause}`,
            params
        );
        const total = countResult.rows[0].total;

        // Datos paginados con JOIN a usuarios para nombre
        const dataResult = await db.query(`
            SELECT 
                a.id,
                a.usuario_id,
                u.nombre as usuario_nombre,
                a.accion,
                a.tabla,
                a.registro_id,
                a.datos_anteriores,
                a.datos_nuevos,
                a.ip_address,
                a.created_at
            FROM auditoria a
            LEFT JOIN usuarios u ON a.usuario_id = u.id
            ${whereClause}
            ORDER BY a.created_at DESC
            LIMIT ? OFFSET ?
        `, [...params, limit, offset]);

        res.json({
            items: dataResult.rows,
            total,
            pagina: page,
            totalPaginas: Math.ceil(total / limit)
        });

    } catch (error) {
        console.error('Error al obtener auditoría:', error);
        res.status(500).json({ error: 'Error al obtener auditoría' });
    }
});

// GET /api/reportes/auditoria/:id - Detalle de una entrada de auditoría
router.get('/auditoria/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;

        const result = await db.query(`
            SELECT 
                a.id,
                a.usuario_id,
                u.nombre as usuario_nombre,
                a.accion,
                a.tabla,
                a.registro_id,
                a.datos_anteriores,
                a.datos_nuevos,
                a.ip_address,
                a.created_at
            FROM auditoria a
            LEFT JOIN usuarios u ON a.usuario_id = u.id
            WHERE a.id = ?
        `, [req.params.id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Registro de auditoría no encontrado' });
        }

        res.json({ auditoria: result.rows[0] });

    } catch (error) {
        console.error('Error al obtener detalle de auditoría:', error);
        res.status(500).json({ error: 'Error al obtener detalle de auditoría' });
    }
});

module.exports = router;
