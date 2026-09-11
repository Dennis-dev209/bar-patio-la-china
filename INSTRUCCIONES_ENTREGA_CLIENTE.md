# INSTRUCCIONES DE ENTREGA AL CLIENTE — Bar Patio La China
Fecha: 11/09/2026 | Usuario que entrega: Dennis | Estado: listo para entrega

---
## 1. QUÉ ENTREGA HOY

Sistema completo en funcionamiento. Se generó backup de seguridad antes de la entrega.

### Cambios aplicados hoy (verificados en código)
- [x] Tasa limpia: `placeholder="Ej: 120"`, obligatorio escribir (no hay valor por defecto 120)
- [x] USD por defecto; CUP bloquea tasa en 1 automáticamente
- [x] Tarjeta ordenante muestra monto en CUP (`monto_total` con moneda)
- [x] Reportes corregidos: no duplican montos ni remesas
- [x] Mensajes de error específicos (no mensajes genéricos)
- [x] Funcionalidad de restaurar clientes (`soft delete` con `/clientes/:id/restaurar`)
- [x] Funcionalidad de backup (`npm run db:backup`)

---
## 2. CÓMO HACER EL BACKUP (instrucción para el cliente)

Desde la terminal, en la carpeta del proyecto:
```bash
npm run db:backup
```
Esto crea `backups/backup-YYYY-MM-DD_HH-mm.sql` con todos los datos del sistema.

**Archivo generado hoy:** `backups/backup_pre_entrega_20260911.sql`

Para restaurar en caso de pérdida:
```bash
sqlite3 data/database.sqlite < backups/backup_pre_entrega_20260911.sql
```

---
## 3. INSTRUCCIONES PARA EL CLIENTE (paso a paso)

### A. Abrir el sistema
```bash
# Si está en producción (Render):
https://bar-patio-la-china.onrender.com

# Si está en local:
npm start
# Luego abrir: http://localhost:3000
```

### B. Iniciar sesión
- **Admin:** `admin@patiolachina.com` / `admin123`
- **Empleado:** `empleado1@patiolachina.com` / `admin123`

### C. Crear un cliente (remesero)
1. Clic en **Clientes** (o ir a `/clientes`)
2. Clic en **Nuevo Cliente**
3. Completar nombre, teléfono, país → Guardar

### D. Crear ordenante
1. Seleccionar el cliente creado
2. Clic en **Nuevo Ordenante**
3. Completar nombre
4. Elegir moneda (`USD` por defecto):
   - Si es **USD**: escribir la tasa manual (ej. 150)
   - Si es **CUP**: la tasa se bloquea en 1 automáticamente (no se edita)
5. Escribir importe → el sistema calcula el monto en CUP automáticamente

### E. Registrar depósito (remesa)
1. Clic en **Remesas**
2. Clic en **Nuevo Depósito**
3. Seleccionar el ordenante creado
4. Completar fecha, moneda (`USD` por defecto), importe y tasa (`Ej: 150` si es USD; `1` si es CUP, bloqueado)
5. Escribir referencia (opcional)
6. Clic en **Guardar**

### F. Confirmar / desconfirmar depósito
1. En la lista de remesas, buscar el depósito recién creado (estado: **Pendiente**)
2. Clic en **Confirmar** (o botón correspondiente)
3. Para revertir: clic en **Desconfirmar**

### G. Ver reportes
1. Clic en **Reportes**
2. Opciones disponibles:
   - **Resumen**: totales generales, pendiente vs confirmado, montos en CUP
   - **Por período**: diario / mensual / anual
   - **Por remesero**: desglose por cliente
   - **Pendientes**: solo los no confirmados

### H. Exportar
- Desde cualquier tabla de remesas o reportes, clic en **Excel** o **PDF**

---
## 4. FUNCIONAMIENTO DEL SISTEMA (conceptos clave para el cliente)

### Monedas y tasas
- **USD / EUR / otras monedas extranjeras**: el usuario escribe la tasa de cambio (ej. 150 CUP por 1 USD). El sistema calcula automáticamente `importe_cup = importe * tasa`.
- **CUP**: la tasa siempre es `1`. El sistema la bloquea automáticamente; no se puede modificar.

### Tarjeta del ordenante (resumen visual)
- Muestra: nombre, país, moneda, monto total en CUP, cantidad de depósitos, estado (Pendiente / Confirmado)
- Si hay montos pendientes, aparece una marca visual (`pendiente`)

### Confirmación / conciliación
- Cada depósito tiene un estado: `pendiente` o `confirmado`
- Confirmar significa que el dinero fue recibido; desconfirmar lo devuelva a pendiente
- El resumen general cuenta solo depósitos confirmados para montos confirmados, y solo pendientes para montos pendientes

### Restauración (soft delete)
- Si un cliente se elimina por error: ir a clientes, buscar en lista (o usar endpoint `/clientes/:id/restaurar` si hay acceso técnico)
- Esto restaura el cliente sin perder sus datos

---
## 5. ARCHIVOS GENERADOS HOY (evidencia de entrega)

| Archivo | Propósito | Ubicación |
|---|---|---|
| `backups/backup_pre_entrega_20260911.sql` | Respaldo completo de BD (SQLite) | `backups/` |
| `PLAN_ENTREGA_HOY.md` (en memoria) | Plan completo de entrega | (se genera después) |
| `frontend/js/ordenantes.js` (modificado) | Tasa limpia, CUP bloqueado, tarjeta en CUP | `frontend/js/` |
| `frontend/js/remesas.js` (modificado) | Validación tasa > 0, CUP auto | `frontend/js/` |

---
## 6. PRUEBA FUNCIONAL REALIZADA (resumen)

Se ejecutó con datos simulados (`ENTREGA-HOY-*`) antes del backup:
- Cliente simulado creado → ordenante USD (tasa 150) + ordenante CUP (tasa 1 auto)
- Depósitos registrados → confirmación / desconfirmación
- Reportes verificados: resumen, período, remesero, pendientes
- Datos de prueba limpiados después
- Backup generado con datos originales intactos

---
## 7. CONTACTO / SOPORTE POST-ENTREGA

Si hay problemas con el deploy en Render o el código no se refleja:
- Verificar que el servicio esté en **Live** en `dashboard.render.com`
- Si no refleja los cambios nuevos (tasa limpia, CUP bloqueado), hacer **Manual Deploy → Deploy latest commit**
- Confirmar con `curl -s https://bar-patio-la-china.onrender.com/ordenantes | grep "Ej: 120"`
