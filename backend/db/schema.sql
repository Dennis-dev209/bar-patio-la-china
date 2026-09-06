-- ============================================
-- SISTEMA DE CONCILIACIÓN DE REMESAS
-- Bar Patio La China
-- Compatible con SQLite
-- ============================================

-- USUARIOS (sistema)
CREATE TABLE IF NOT EXISTS usuarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    rol TEXT DEFAULT 'empleado' CHECK (rol IN ('admin', 'empleado')),
    activo INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- REMESEROS (clientes del negocio)
CREATE TABLE IF NOT EXISTS remeseros (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL,
    telefono TEXT,
    descripcion TEXT,
    activo INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ORDENANTES (envían dinero)
CREATE TABLE IF NOT EXISTS ordenantes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    remesero_id INTEGER NOT NULL,
    nombre TEXT NOT NULL,
    telefono TEXT,
    pais_origen TEXT,
    activo INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (remesero_id) REFERENCES remeseros(id) ON DELETE CASCADE
);

-- REMESAS (depósitos/conciliación)
CREATE TABLE IF NOT EXISTS remesas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ordenante_id INTEGER NOT NULL,
    remesero_id INTEGER NOT NULL,
    fecha_deposito DATE NOT NULL,
    moneda TEXT NOT NULL DEFAULT 'USD',
    importe REAL NOT NULL,
    tasa_cambio REAL NOT NULL DEFAULT 1.0,
    importe_cup REAL NOT NULL,
    referencia TEXT,
    cantidad_deposito REAL,
    estado TEXT DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'confirmado')),
    confirmado_por INTEGER,
    fecha_confirmacion DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ordenante_id) REFERENCES ordenantes(id) ON DELETE CASCADE,
    FOREIGN KEY (remesero_id) REFERENCES remeseros(id) ON DELETE CASCADE,
    FOREIGN KEY (confirmado_por) REFERENCES usuarios(id)
);

-- TOKENS DE RECUPERACIÓN DE CONTRASEÑA
CREATE TABLE IF NOT EXISTS reset_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    usuario_id INTEGER NOT NULL,
    token TEXT NOT NULL,
    expira_en DATETIME NOT NULL,
    used INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
);

-- TABLA DE AUDITORÍA (quién hizo qué)
CREATE TABLE IF NOT EXISTS auditoria (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    usuario_id INTEGER,
    accion TEXT NOT NULL,
    tabla TEXT NOT NULL,
    registro_id INTEGER,
    datos_anteriores TEXT,
    datos_nuevos TEXT,
    ip_address TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
);

-- ÍNDICES para mejorar rendimiento
CREATE INDEX IF NOT EXISTS idx_remeseros_activo ON remeseros(activo);
CREATE INDEX IF NOT EXISTS idx_ordenantes_remesero ON ordenantes(remesero_id);
CREATE INDEX IF NOT EXISTS idx_ordenantes_activo ON ordenantes(activo);
CREATE INDEX IF NOT EXISTS idx_remesas_ordenante ON remesas(ordenante_id);
CREATE INDEX IF NOT EXISTS idx_remesas_remesero ON remesas(remesero_id);
CREATE INDEX IF NOT EXISTS idx_remesas_estado ON remesas(estado);
CREATE INDEX IF NOT EXISTS idx_remesas_fecha ON remesas(fecha_deposito);
CREATE INDEX IF NOT EXISTS idx_auditoria_usuario ON auditoria(usuario_id);
CREATE INDEX IF NOT EXISTS idx_auditoria_fecha ON auditoria(created_at);

-- TRIGGERS para actualizar updated_at
CREATE TRIGGER IF NOT EXISTS update_usuarios_updated_at 
AFTER UPDATE ON usuarios
BEGIN
    UPDATE usuarios SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_remeseros_updated_at 
AFTER UPDATE ON remeseros
BEGIN
    UPDATE remeseros SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_ordenantes_updated_at 
AFTER UPDATE ON ordenantes
BEGIN
    UPDATE ordenantes SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_remesas_updated_at 
AFTER UPDATE ON remesas
BEGIN
    UPDATE remesas SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;
