# RESULTADOS PRUEBA FUNCIONAL A — MULTI CUENTA
Fecha: 11/09/2026 18:00 | Usuario: Dennis | Sistema: bar-patio-la-china (deploy + local)

---
## 1. BACKUP GENERADO
- Archivo: `backups/backup_pre_entrega_20260911.sql`
- Tamaño: ~118 KB
- Contenido: esquema + INSERTs de usuarios, remeseros, ordenantes, remesas, reset_tokens, auditoria
- Comando usado: `npm run db:backup` (funcionó con Turso en la nube)

---
## 2. INSTRUCCIONES DE ENTREGA AL CLIENTE
- Archivo: `INSTRUCCIONES_ENTREGA_CLIENTE.md`
- Incluye: pasos paso a paso, funcionamiento de tasas/CUP, confirmación, reportes, exportación, restauración

---
## 3. PRUEBA FUNCIONAL A — RESULTADOS
Estado: COMPLETA ✅ (todos los pasos pasaron)

### Cuentas creadas y trabajadas
| Cuenta / Rol | Datos creados | Operaciones realizadas |
|---|---|---|
| Admin (token JWT) | Login exitoso | Creación, confirmación, reportes, eliminación |
| Remesero A (`ENTREGA-HOY-REM-A`) | Cliente creado (id=17) | Ordenante USD + CUP, depósitos, confirmación/desconfirmación |
| Remesero B (`ENTREGA-HOY-REM-B`) | Cliente creado (id=18) | Creado y eliminado (soft delete verificado) |
| Ordenante USD (`ENTREGA-HOY-USD`) | Creado (id=48) | Remesa registrada (id=54), tasa 150, CUP=15,000 |
| Ordenante CUP (`ENTREGA-HOY-CUP`) | Creado (id=49) | Remesa registrada (id=55), tasa 1 (auto), CUP=5,000 |

### Operaciones verificadas paso a paso
- [x] Login admin (`200`, token recibido)
- [x] Crear cliente A (`201`, id=17)
- [x] Crear cliente B (`201`, id=18)
- [x] Crear ordenante USD (`201`, tasa 150, importe 100)
- [x] Crear ordenante CUP (`201`, tasa 1 auto, importe 5,000)
- [x] Registrar remesa USD (`201`, tasa=150, CUP=15,000)
- [x] Registrar remesa CUP (`201`, tasa=1, CUP=5,000)
- [x] Confirmar remesa USD (`200`, estado=confirmado)
- [x] Desconfirmar remesa USD (`200`, estado=pendiente)
- [x] Reporte resumen (`200`, montos verificados)
- [x] Reporte pendientes (`200`)
- [x] Tarjeta ordenantes (`200`, monto en CUP verificado: 10,000 total pendiente)
- [x] Eliminar remesa USD (`200`)
- [x] Eliminar remesa CUP (`200`)
- [x] Eliminar ordenante USD (`200`)
- [x] Eliminar ordenante CUP (`200`)
- [x] Eliminar cliente B (`200`)
- [x] Eliminar cliente A (`200`)

### Datos residuales verificados (post-limpieza)
- Remesas restantes: 43 (las originales del sistema, sin datos de prueba)
- Clientes: los originales, sin `ENTREGA-HOY-*`
- Ordenantes: los originales, sin datos de prueba

---
## 4. DEPLOY EN RENDER VERIFICADO
- URL: `https://bar-patio-la-china.onrender.com`
- Estado: **Live** (confirmado por usuario)
- Verificación de código: `curl` muestra `placeholder="Ej: 120"` (cambio aplicado) ✅
- Login funciona con datos de prueba (token recibido) ✅
- Base de datos: Turso (SQLite en la nube) conectada correctamente ✅

---
## 5. ARCHIVOS MODIFICADOS EN ESTA SESION
- `frontend/js/ordenantes.js` (tasa limpia, CUP bloqueado, tarjeta en CUP)
- `frontend/js/remesas.js` (validación tasa > 0)
- `frontend/ordenantes.html` (inputs con placeholder)
- `frontend/remesas.html` (inputs con placeholder)
- `frontend/js/api.js` (`syncTasaForMoneda` exportado)
- `backend/routes/remesas.js` (tasa=1 si moneda=CUP)
- `backend/routes/ordenantes.js` (tasa=1 si moneda=CUP)
- `backend/routes/reportes.js` (LEFT JOIN corregido)
- `INSTRUCCIONES_ENTREGA_CLIENTE.md` (nuevo)
- `prueba_funcional_a.js` (script de prueba, nuevo)
- `backups/backup_pre_entrega_20260911.sql` (nuevo)

---
## 6. ESTADO DEL SISTEMA AL FINAL DE LA ENTREGA
- Código actualizado en `main` (`0bf9894` + `8cb266c` + `19d282c` + anteriores)
- Deploy en Render reflejando los cambios nuevos (`placeholder="Ej: 120"` verificado)
- Base de datos con datos originales intactos (prueba limpiada)
- Backup generado y disponible (`backups/backup_pre_entrega_20260911.sql`)
- Instrucciones completas para el cliente (`INSTRUCCIONES_ENTREGA_CLIENTE.md`)
- Prueba funcional A completa con evidencia (`prueba_funcional_a.js` + resultados en consola)
