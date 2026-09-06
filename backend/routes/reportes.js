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
            LEFT JOIN remesas rem ON r.id = rem.remesero_id
            WHERE r.activo = 1
        `);

        res.json({ resumen: result.rows[0] });

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

        let query = `
            SELECT 
                ${groupBy} as periodo,
                COUNT(*) as total_remesas,
                COALESCE(SUM(CASE WHEN estado = 'pendiente' THEN importe_cup ELSE 0 END), 0) as monto_pendiente,
                COALESCE(SUM(CASE WHEN estado = 'confirmado' THEN importe_cup ELSE 0 END), 0) as monto_confirmado,
                COALESCE(SUM(importe_cup), 0) as monto_total,
                COUNT(CASE WHEN estado = 'pendiente' THEN 1 END) as pendientes,
                COUNT(CASE WHEN estado = 'confirmado' THEN 1 END) as confirmadas
            FROM remesas rem
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

        query += ` GROUP BY ${groupBy} ORDER BY periodo DESC`;

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

        let query = `
            SELECT 
                r.id,
                r.nombre,
                COUNT(rem.id) as total_remesas,
                COALESCE(SUM(CASE WHEN rem.estado = 'pendiente' THEN rem.importe_cup ELSE 0 END), 0) as monto_pendiente,
                COALESCE(SUM(CASE WHEN rem.estado = 'confirmado' THEN rem.importe_cup ELSE 0 END), 0) as monto_confirmado,
                COALESCE(SUM(rem.importe_cup), 0) as monto_total,
                COUNT(CASE WHEN rem.estado = 'pendiente' THEN 1 END) as pendientes,
                COUNT(CASE WHEN rem.estado = 'confirmado' THEN 1 END) as confirmadas
            FROM remeseros r
            LEFT JOIN remesas rem ON r.id = rem.remesero_id
        `;
        const conditions = [];
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

        query += ` GROUP BY r.id, r.nombre ORDER BY monto_total DESC`;

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

        // Calcular totales
        const totales = await db.query(`
            SELECT 
                COUNT(*) as cantidad,
                COALESCE(SUM(importe_cup), 0) as monto_total
            FROM remesas
            WHERE estado = 'pendiente'
        `);

        res.json({
            pendientes: result.rows,
            totales: totales.rows[0]
        });

    } catch (error) {
        console.error('Error al obtener pendientes:', error);
        res.status(500).json({ error: 'Error al obtener pendientes' });
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
