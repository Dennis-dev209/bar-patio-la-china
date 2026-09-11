# MANTENIMIENTO SEMANAL — Bar Patio La China
Fecha: 11/09/2026 | Modo: operativo | Usuario: Dennis

---
## CUÁNDO HACERLO
Cada semana, preferiblemente el mismo día y hora (ej. lunes 9:00 AM), antes de que empiece el tráfico del cliente.

---
## PASOS (en orden)

### 1. BACKUP (obligatorio, siempre primero)
```bash
npm run db:backup
```
Esto genera `backups/backup-YYYY-MM-DD_HH-mm.sql` con todos los datos (SQLite / Turso).
Verifica que el archivo exista y tenga tamaño (> 10 KB normalmente):
```bash
dir backups\
```
Si no se generó, revisa `.env` y que `DATABASE_URL` esté conectada.

### 2. VERIFICAR DEPLOY EN RENDER
Abre en navegador:
```
https://bar-patio-la-china.onrender.com
```
O con `curl`:
```bash
curl -s -o NUL -w "Status: %{http_code}\n" https://bar-patio-la-china.onrender.com
```
Debe devolver `200`. Si dice `Live` en `dashboard.render.com`, está bien.

Si los cambios nuevos (`placeholder="Ej: 120"`, CUP bloqueado) no se reflejan:
- Entra a `dashboard.render.com`
- Clic en **Manual Deploy → Deploy latest commit**
- Espera 2-4 minutos y confirma con `curl`

### 3. REVISAR DATOS EN PRODUCCIÓN (visualmente o con scripts)
Abre el sistema con cuenta admin (`admin@patiolachina.com`) y revisa:
- [ ] Clientes activos (no debería haber datos de prueba `ENTREGA-HOY-*`)
- [ ] Ordenantes por cliente: montos en CUP correctos
- [ ] Remesas: no debería haber depósitos con tasas raras (ej. tasa 999 en CUP)
- [ ] Reportes → Resumen: montos no duplicados
- [ ] Reportes → Pendientes: solo los que realmente están sin confirmar

Si hay datos de prueba: elimínalos manualmente (clientes, ordenantes, remesas) y confirma que el resumen se actualiza.

### 4. PRUEBA FUNCIONAL RÁPIDA (5 minutos)
Crea un cliente de prueba temporal (`MANT-SEMANA-REM-A`), un ordenante USD (tasa 150) y un depósito de 1 USD (CUP = 150). Confirma, luego elimina todo (`DELETE`). Esto confirma que todo funciona sin afectar datos reales.

O usa el script existente:
```bash
node prueba_funcional_a.js
```
(Y luego limpia manualmente los datos de prueba que genere, o usa el script con datos `ENTREGA-HOY-*` que ya está verificado).

### 5. LIMPIEZA DE BACKUPS ANTIGUOS (opcional, cada mes)
Revisa la carpeta `backups/`. Si hay más de 10 archivos, borra los más antiguos:
```bash
# Ejemplo en Windows (manual):
del backups\backup-2026-08-*.sql
```
No borres el más reciente (`backup-YYYY-MM-DD...`) ni el `backup_pre_entrega_...`.

### 6. ACTUALIZACIÓN DE DEPENDENCIAS (cada mes o cada 4 semanas)
```bash
npm update
npm audit fix
```
Si hay errores críticos, no hagas deploy sin probar primero en local.

### 7. REVISAR LOGS DE ERROR (opcional, si hay problemas)
Si el sistema falló o hay quejas del cliente:
```bash
# En local (si el servidor está corriendo):
# Revisa la terminal donde corre `npm start`
# O revisa los logs del servicio en Render (Events / Logs)
```
Busca errores como `Error al obtener resumen`, `tardó demasiado`, `token`, `database`.

---
## ARCHIVOS DE REFERENCIA
- `package.json`: comandos (`start`, `dev`, `db:backup`, `db:seed`)
- `.env`: `DATABASE_URL` (Turso) y `TURSO_TOKEN`
- `backend/db/backup.js`: código del respaldo (SQLite con DELETE + INSERT)
- `backups/`: archivos `.sql` generados
- `INSTRUCCIONES_ENTREGA_CLIENTE.md`: instrucciones paso a paso para el cliente
- `RESULTADOS_PRUEBA_A.md`: evidencia de la última prueba completa
- `prueba_funcional_a.js`: script automatizado de prueba funcional

---
## ESTADO ACTUAL DEL SISTEMA (última verificación: hoy)
- Repositorio: `main` actualizado (`0bf9894`, `8cb266c`, `19d282c`)
- Deploy Render: `Live`, reflejando cambios nuevos (`placeholder="Ej: 120"` verificado)
- Base de datos: Turso conectada, datos originales intactos
- Backup: `backup_pre_entrega_20260911.sql` generado hoy
- Prueba A: completa, datos limpiados
- Instrucciones cliente: `INSTRUCCIONES_ENTREGA_CLIENTE.md`
