const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { db } = require('../config/database');
const { authenticateToken, requireAdmin, logAudit } = require('../middleware/auth');
const { parsePassword } = require('../middleware/validation');
require('dotenv').config();

// ============================================
// POST /api/auth/login
// Iniciar sesión
// ============================================
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        // Validar campos
        if (!email || !password) {
            return res.status(400).json({ error: 'Email y contraseña son requeridos' });
        }

        // Buscar usuario
        const result = await db.query(
            'SELECT id, nombre, email, password_hash, rol, activo FROM usuarios WHERE email = ?',
            [email]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Credenciales inválidas' });
        }

        const usuario = result.rows[0];

        // Verificar si está activo (Turso puede devolver BigInt)
        if (Number(usuario.activo) === 0) {
            return res.status(403).json({ error: 'Cuenta desactivada' });
        }

        // Verificar contraseña
        const passwordValid = bcrypt.compareSync(password, usuario.password_hash);
        if (!passwordValid) {
            return res.status(401).json({ error: 'Credenciales inválidas' });
        }

        // Crear token JWT
        const token = jwt.sign(
            { 
                id: usuario.id, 
                email: usuario.email, 
                rol: usuario.rol,
                nombre: usuario.nombre
            },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
        );

        // Registrar auditoría
        logAudit(db, usuario.id, 'login', 'usuarios', usuario.id, null, null, req.ip);

        res.json({
            message: 'Login exitoso',
            token,
            usuario: {
                id: usuario.id,
                nombre: usuario.nombre,
                email: usuario.email,
                rol: usuario.rol
            }
        });

    } catch (error) {
        console.error('Error en login:', error);
        res.status(500).json({ error: 'Error al iniciar sesión' });
    }
});

// ============================================
// POST /api/auth/register
// Registrar nuevo usuario (solo admin)
// ============================================
router.post('/register', authenticateToken, requireAdmin, async (req, res) => {
    try {
        // Verificar que sea admin
        if (req.user.rol !== 'admin') {
            return res.status(403).json({ error: 'Solo administradores pueden crear usuarios' });
        }

        const { nombre, email, password, rol } = req.body;

        // Validar campos
        if (!nombre || !email || !password) {
            return res.status(400).json({ error: 'Nombre, email y contraseña son requeridos' });
        }

        // Política de contraseñas: mínimo 8 caracteres
        const cleanPassword = parsePassword(password);
        if (cleanPassword === null) {
            return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres' });
        }

        // Verificar si el email ya existe
        const existingUser = await db.query(
            'SELECT id FROM usuarios WHERE email = ?',
            [email]
        );

        if (existingUser.rows.length > 0) {
            return res.status(400).json({ error: 'El email ya está registrado' });
        }

        // Hashear contraseña
        const salt = bcrypt.genSaltSync(10);
        const password_hash = bcrypt.hashSync(cleanPassword, salt);

        // Crear usuario
        const result = await db.query(
            `INSERT INTO usuarios (nombre, email, password_hash, rol) 
             VALUES (?, ?, ?, ?)`,
            [nombre, email, password_hash, rol || 'empleado']
        );

        // Obtener el usuario creado
        const nuevoUsuario = (await db.query(
            'SELECT id, nombre, email, rol, activo, created_at FROM usuarios WHERE email = ?',
            [email]
        )).rows[0];

        // Registrar auditoría
        logAudit(db, req.user.id, 'crear', 'usuarios', nuevoUsuario.id, null, nuevoUsuario, req.ip);

        res.status(201).json({
            message: 'Usuario creado exitosamente',
            usuario: nuevoUsuario
        });

    } catch (error) {
        console.error('Error al registrar usuario:', error);
        res.status(500).json({ error: 'Error al crear usuario' });
    }
});

// ============================================
// POST /api/auth/forgot-password
// Solicitar recuperación de contraseña
// ============================================
router.post('/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ error: 'Email es requerido' });
        }

        // Buscar usuario
        const result = await db.query(
            'SELECT id, email FROM usuarios WHERE email = ? AND activo = 1',
            [email]
        );

        // Siempre devolver mensaje genérico por seguridad
        if (result.rows.length === 0) {
            return res.json({ message: 'Si el email existe, recibirás instrucciones de recuperación' });
        }

        const usuario = result.rows[0];

        // Limpieza oportunista: borrar tokens usados o expirados
        await db.query(`DELETE FROM reset_tokens WHERE used = 1 OR expira_en <= datetime('now')`);

        // Generar token
        const token = crypto.randomBytes(32).toString('hex');
        const expiraEn = new Date(Date.now() + 3600000).toISOString(); // 1 hora

        // Guardar token
        await db.query(
            `INSERT INTO reset_tokens (usuario_id, token, expira_en) 
             VALUES (?, ?, ?)`,
            [usuario.id, token, expiraEn]
        );

        // TODO: Enviar email con el token
        // Por ahora, solo devolver el token (en producción, enviar por email)
        console.log(`Token de recuperación para ${email}: ${token}`);

        res.json({ 
            message: 'Si el email existe, recibirás instrucciones de recuperación',
            // Solo para desarrollo:
            token: process.env.NODE_ENV === 'development' ? token : undefined
        });

    } catch (error) {
        console.error('Error en forgot-password:', error);
        res.status(500).json({ error: 'Error al procesar solicitud' });
    }
});

// ============================================
// POST /api/auth/reset-password
// Restablecer contraseña con token
// ============================================
router.post('/reset-password', async (req, res) => {
    try {
        const { token, newPassword } = req.body;

        if (!token || !newPassword) {
            return res.status(400).json({ error: 'Token y nueva contraseña son requeridos' });
        }

        const cleanNewPassword = parsePassword(newPassword);
        if (cleanNewPassword === null) {
            return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres' });
        }

        // Buscar token válido
        const result = await db.query(
            `SELECT id, usuario_id, expira_en FROM reset_tokens 
             WHERE token = ? AND used = 0 AND expira_en > datetime('now')`,
            [token]
        );

        if (result.rows.length === 0) {
            return res.status(400).json({ error: 'Token inválido o expirado' });
        }

        const resetToken = result.rows[0];

        // Hashear nueva contraseña
        const salt = bcrypt.genSaltSync(10);
        const password_hash = bcrypt.hashSync(cleanNewPassword, salt);

        // Actualizar contraseña
        await db.query(
            'UPDATE usuarios SET password_hash = ? WHERE id = ?',
            [password_hash, resetToken.usuario_id]
        );

        // Marcar token como usado
        await db.query(
            'UPDATE reset_tokens SET used = 1 WHERE id = ?',
            [resetToken.id]
        );

        // Registrar auditoría
        logAudit(db, resetToken.usuario_id, 'reset_password', 'usuarios', resetToken.usuario_id, null, null, req.ip);

        res.json({ message: 'Contraseña actualizada exitosamente' });

    } catch (error) {
        console.error('Error en reset-password:', error);
        res.status(500).json({ error: 'Error al restablecer contraseña' });
    }
});

// ============================================
// GET /api/auth/me
// Obtener usuario actual
// ============================================
router.get('/me', authenticateToken, async (req, res) => {
    try {
        const result = await db.query(
            'SELECT id, nombre, email, rol, activo FROM usuarios WHERE id = ?',
            [req.user.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }

        res.json({ usuario: result.rows[0] });

    } catch (error) {
        console.error('Error al obtener usuario:', error);
        res.status(500).json({ error: 'Error al obtener información del usuario' });
    }
});

// ============================================
// PUT /api/auth/change-password
// Cambiar contraseña (usuario autenticado)
// ============================================
router.put('/change-password', authenticateToken, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({ error: 'Contraseña actual y nueva contraseña son requeridas' });
        }

        const cleanNewPassword = parsePassword(newPassword);
        if (cleanNewPassword === null) {
            return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 8 caracteres' });
        }

        // Obtener contraseña actual
        const result = await db.query(
            'SELECT password_hash FROM usuarios WHERE id = ?',
            [req.user.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }

        // Verificar contraseña actual
        const passwordValid = bcrypt.compareSync(currentPassword, result.rows[0].password_hash);
        if (!passwordValid) {
            return res.status(401).json({ error: 'Contraseña actual incorrecta' });
        }

        // Hashear nueva contraseña
        const salt = bcrypt.genSaltSync(10);
        const password_hash = bcrypt.hashSync(cleanNewPassword, salt);

        // Actualizar
        await db.query(
            'UPDATE usuarios SET password_hash = ? WHERE id = ?',
            [password_hash, req.user.id]
        );

        res.json({ message: 'Contraseña actualizada exitosamente' });

    } catch (error) {
        console.error('Error en change-password:', error);
        res.status(500).json({ error: 'Error al cambiar contraseña' });
    }
});

// ============================================
// GET /api/auth/users
// Listar todos los usuarios (solo admin)
// ============================================
router.get('/users', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const result = await db.query(
            'SELECT id, nombre, email, rol, activo, created_at FROM usuarios ORDER BY created_at DESC'
        );

        res.json({ usuarios: result.rows });

    } catch (error) {
        console.error('Error al obtener usuarios:', error);
        res.status(500).json({ error: 'Error al obtener usuarios' });
    }
});

// ============================================
// DELETE /api/auth/users/:id
// Desactivar usuario (solo admin, no puede desactivarse a sí mismo).
// Es borrado SUAVE (activo=0): el borrado físico falla por las claves
// foráneas (auditoría, confirmaciones) y rompería el historial.
// Un usuario inactivo no puede entrar (lo bloquea authenticateToken).
// ============================================
router.delete('/users/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;

        // No puede eliminarse a sí mismo
        if (parseInt(id) === req.user.id) {
            return res.status(400).json({ error: 'No puedes eliminar tu propia cuenta' });
        }

        // Verificar que el usuario existe
        const userCheck = await db.query('SELECT id, nombre, activo FROM usuarios WHERE id = ?', [id]);
        if (userCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }

        // Desactivar (borrado suave)
        await db.query('UPDATE usuarios SET activo = 0 WHERE id = ?', [id]);

        // Registrar auditoría
        logAudit(db, req.user.id, 'desactivar', 'usuarios', parseInt(id), userCheck.rows[0], null, req.ip);

        res.json({ message: 'Usuario desactivado exitosamente' });

    } catch (error) {
        console.error('Error al eliminar usuario:', error);
        res.status(500).json({ error: 'Error al eliminar usuario' });
    }
});

// ============================================
// PUT /api/auth/users/:id/activar
// Reactivar usuario desactivado (solo admin)
// ============================================
router.put('/users/:id/activar', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;

        const userCheck = await db.query('SELECT id FROM usuarios WHERE id = ?', [id]);
        if (userCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }

        await db.query('UPDATE usuarios SET activo = 1 WHERE id = ?', [id]);

        logAudit(db, req.user.id, 'reactivar', 'usuarios', parseInt(id), null, null, req.ip);

        res.json({ message: 'Usuario reactivado exitosamente' });

    } catch (error) {
        console.error('Error al reactivar usuario:', error);
        res.status(500).json({ error: 'Error al reactivar usuario' });
    }
});

// ============================================
// PUT /api/auth/users/:id/role
// Cambiar rol de usuario (solo admin)
// ============================================
router.put('/users/:id/role', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { rol } = req.body;

        if (!rol || !['admin', 'empleado'].includes(rol)) {
            return res.status(400).json({ error: 'Rol inválido. Usa: admin o empleado' });
        }

        // No puede cambiar su propio rol
        if (parseInt(id) === req.user.id) {
            return res.status(400).json({ error: 'No puedes cambiar tu propio rol' });
        }

        // Verificar que el usuario existe
        const userCheck = await db.query('SELECT id FROM usuarios WHERE id = ?', [id]);
        if (userCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }

        // Actualizar rol
        await db.query('UPDATE usuarios SET rol = ? WHERE id = ?', [rol, parseInt(id)]);

        // Registrar auditoría
        logAudit(db, req.user.id, 'update', 'usuarios', parseInt(id), null, { rol }, req.ip);

        res.json({ message: 'Rol actualizado exitosamente' });

    } catch (error) {
        console.error('Error al cambiar rol:', error);
        res.status(500).json({ error: 'Error al cambiar rol' });
    }
});

module.exports = router;
