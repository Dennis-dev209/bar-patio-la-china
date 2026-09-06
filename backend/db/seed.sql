-- ============================================
-- DATOS DE PRUEBA
-- Bar Patio La China
-- ============================================

-- USUARIOS (contraseña: admin123 para todos)
-- Nota: En producción, las contraseñas deben estar hasheadas con bcrypt
-- Este hash es para "admin123"
INSERT INTO usuarios (nombre, email, password_hash, rol) VALUES
('Administrador', 'admin@patiolachina.com', '$2a$10$YourHashedPasswordHere', 'admin'),
('Empleado 1', 'empleado1@patiolachina.com', '$2a$10$YourHashedPasswordHere', 'empleado'),
('Empleado 2', 'empleado2@patiolachina.com', '$2a$10$YourHashedPasswordHere', 'empleado');

-- REMESEROS (clientes)
INSERT INTO remeseros (nombre, telefono, descripcion) VALUES
('Juan Pérez', '+53 5555 1234', 'Cliente frecuente, envía mensualmente'),
('María García', '+53 5555 5678', 'Cliente preferente'),
('Carlos Rodríguez', '+53 5555 9012', 'Nuevo cliente'),
('Ana Martínez', '+53 5555 3456', 'Cliente desde 2024'),
('Roberto Sánchez', '+53 5555 7890', 'Cliente corporativo');

-- ORDENANTES
INSERT INTO ordenantes (remesero_id, nombre, telefono, pais_origen) VALUES
-- Juan Pérez
(1, 'Pedro López', '+1 305 555 1111', 'Estados Unidos'),
(1, 'Luis Hernández', '+1 305 555 2222', 'Estados Unidos'),
(1, 'Miguel Torres', '+34 612 345 678', 'España'),
-- María García
(2, 'Fernando Díaz', '+1 786 555 3333', 'Estados Unidos'),
(2, 'Sandra Morales', '+34 623 456 789', 'España'),
-- Carlos Rodríguez
(3, 'José Gómez', '+1 713 555 4444', 'Estados Unidos'),
-- Ana Martínez
(4, 'Ricardo Vargas', '+52 55 1234 5678', 'México'),
(4, 'Patricia Romero', '+52 55 9876 5432', 'México'),
(4, 'Eduardo Silva', '+1 212 555 5555', 'Estados Unidos'),
-- Roberto Sánchez
(5, 'Francisco Castro', '+57 310 555 6666', 'Colombia'),
(5, 'Lucía Fernández', '+54 11 5555 7777', 'Argentina');

-- REMESAS (depósitos)
INSERT INTO remesas (ordenante_id, remesero_id, fecha_deposito, moneda, importe, tasa_cambio, importe_cup, referencia, estado) VALUES
-- Pedro López → Juan Pérez
(1, 1, '2026-09-01', 'USD', 500.00, 120.00, 60000.00, 'REF-001', 'confirmado'),
(1, 1, '2026-09-05', 'USD', 300.00, 120.00, 36000.00, 'REF-002', 'confirmado'),
(1, 1, '2026-09-10', 'USD', 750.00, 120.00, 90000.00, 'REF-003', 'pendiente'),
-- Luis Hernández → Juan Pérez
(2, 1, '2026-09-03', 'USD', 200.00, 120.00, 24000.00, 'REF-004', 'confirmado'),
(2, 1, '2026-09-08', 'EUR', 400.00, 130.00, 52000.00, 'REF-005', 'pendiente'),
-- Miguel Torres → Juan Pérez
(3, 1, '2026-09-12', 'EUR', 600.00, 130.00, 78000.00, 'REF-006', 'pendiente'),
-- Fernando Díaz → María García
(4, 2, '2026-09-02', 'USD', 1000.00, 120.00, 120000.00, 'REF-007', 'confirmado'),
(4, 2, '2026-09-07', 'USD', 800.00, 120.00, 96000.00, 'REF-008', 'confirmado'),
-- Sandra Morales → María García
(5, 2, '2026-09-11', 'EUR', 350.00, 130.00, 45500.00, 'REF-009', 'pendiente'),
-- José Gómez → Carlos Rodríguez
(6, 3, '2026-09-04', 'USD', 450.00, 120.00, 54000.00, 'REF-010', 'confirmado'),
(6, 3, '2026-09-09', 'USD', 250.00, 120.00, 30000.00, 'REF-011', 'pendiente'),
-- Ricardo Vargas → Ana Martínez
(7, 4, '2026-09-06', 'MXN', 15000.00, 7.00, 105000.00, 'REF-012', 'confirmado'),
(7, 4, '2026-09-13', 'MXN', 8000.00, 7.00, 56000.00, 'REF-013', 'pendiente'),
-- Patricia Romero → Ana Martínez
(8, 4, '2026-09-14', 'MXN', 12000.00, 7.00, 84000.00, 'REF-014', 'pendiente'),
-- Eduardo Silva → Ana Martínez
(9, 4, '2026-09-15', 'USD', 600.00, 120.00, 72000.00, 'REF-015', 'pendiente'),
-- Francisco Castro → Roberto Sánchez
(10, 5, '2026-09-16', 'COP', 2000000.00, 0.0003, 60000.00, 'REF-016', 'pendiente'),
-- Lucía Fernández → Roberto Sánchez
(11, 5, '2026-09-17', 'ARS', 150000.00, 0.40, 60000.00, 'REF-017', 'pendiente');

-- ACTUALIZAR REMESAS CONFIRMADAS CON DATOS DE CONFIRMACIÓN
UPDATE remesas 
SET confirmado_por = 1, 
    fecha_confirmacion = created_at + INTERVAL '1 hour'
WHERE estado = 'confirmado';
