const jwt = require('jsonwebtoken');
require('dotenv').config();

// Middleware para verificar JWT + revocación efectiva.
// Además de la firma, comprueba que el usuario siga existiendo y activo,
// para que eliminar/desactivar una cuenta corte el acceso de inmediato
// (antes, un token robado o de un exempleado valía hasta 24 h).
const authenticateToken = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
        return res.status(401).json({ error: 'Token de acceso requerido' });
    }

    let decoded;
    try {
        decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
        return res.status(403).json({ error: 'Token inválido o expirado' });
    }

    try {
        // Lazy require para evitar cualquier ciclo de dependencias
        const { db } = require('../config/database');
        const result = await db.query(
            'SELECT id, activo, rol FROM usuarios WHERE id = ?',
            [decoded.id]
        );

        if (result.rows.length === 0 || Number(result.rows[0].activo) === 0) {
            return res.status(403).json({ error: 'Cuenta desactivada o eliminada' });
        }

        // Rol fresco desde la BD: un cambio de rol (o degradación) aplica
        // de inmediato, sin esperar a que el token expire (24 h)
        decoded.rol = result.rows[0].rol;
        req.user = decoded;
        next();
    } catch (error) {
        console.error('Error al verificar usuario:', error);
        return res.status(500).json({ error: 'Error al verificar sesión' });
    }
};

// Middleware para verificar rol de admin
const requireAdmin = (req, res, next) => {
    if (req.user.rol !== 'admin') {
        return res.status(403).json({ error: 'Acceso solo para administradores' });
    }
    next();
};

// Middleware para registrar auditoría
const logAudit = async (db, usuarioId, accion, tabla, registroId, datosAnteriores = null, datosNuevos = null, ipAddress = null) => {
    try {
        await db.query(
            `INSERT INTO auditoria (usuario_id, accion, tabla, registro_id, datos_anteriores, datos_nuevos, ip_address)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [usuarioId, accion, tabla, registroId, 
             datosAnteriores ? JSON.stringify(datosAnteriores) : null,
             datosNuevos ? JSON.stringify(datosNuevos) : null,
             ipAddress]
        );
    } catch (error) {
        console.error('Error al registrar auditoría:', error);
    }
};

module.exports = {
    authenticateToken,
    requireAdmin,
    logAudit
};
