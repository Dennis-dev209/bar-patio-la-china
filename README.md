# 🏠 Bar Patio La China - Sistema de Conciliación de Remesas

Sistema web para la gestión y conciliación de remesas del negocio "Bar Patio La China".

## 📋 Descripción

Este sistema permite gestionar clientes (remeseros), sus ordenantes, y llevar un control de las remesas recibidas del exterior. La función principal es la **conciliación** de pagos, confirmando los depósitos realizados por los ordenantes.

## 🚀 Características

- ✅ **Login seguro** con JWT y contraseñas hasheadas
- ✅ **Gestión de clientes** (remeseros) con CRUD completo
- ✅ **Gestión de ordenantes** por cada cliente
- ✅ **Registro de remesas** con múltiples monedas
- ✅ **Conciliación de pagos** (confirmar/desconfirmar)
- ✅ **Reportes** por período y por cliente
- ✅ **Exportar a Excel y PDF**
- ✅ **Modo oscuro/claro** toggle
- ✅ **Diseño responsive** (PC y móvil)
- ✅ **Auditoría** de cambios

## 🛠️ Tecnologías

### Frontend
- HTML5
- CSS3 (con variables CSS)
- JavaScript vanilla
- Font Awesome (iconos)
- Google Fonts (Bebas Neue + Inter)

### Backend
- Node.js
- Express.js
- PostgreSQL
- JWT (autenticación)
- bcryptjs (contraseñas)

## 📦 Instalación

### 1. Requisitos previos
- Node.js (v18 o superior)
- PostgreSQL (v14 o superior)
- npm o yarn

### 2. Clonar el repositorio
```bash
git clone <url-del-repositorio>
cd bar-patio-la-china
```

### 3. Instalar dependencias
```bash
npm install
```

### 4. Configurar base de datos
1. Crear una base de datos en PostgreSQL:
```sql
CREATE DATABASE bar_patio_la_china;
```

2. Configurar el archivo `.env` con tus credenciales:
```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=bar_patio_la_china
DB_USER=tu_usuario
DB_PASSWORD=tu_password
```

### 5. Inicializar la base de datos
```bash
npm run db:init
```

### 6. (Opcional) Poblar con datos de prueba
```bash
npm run db:seed
```

### 7. Iniciar el servidor
```bash
# Modo desarrollo
npm run dev

# Modo producción
npm start
```

### 8. Abrir en el navegador
```
http://localhost:3000
```

## 👤 Usuarios de Prueba

| Usuario | Email | Contraseña | Rol |
|---------|-------|------------|-----|
| Admin | admin@patiolachina.com | admin123 | admin |
| Empleado 1 | empleado1@patiolachina.com | admin123 | empleado |
| Empleado 2 | empleado2@patiolachina.com | admin123 | empleado |

## 📁 Estructura del Proyecto

```
bar-patio-la-china/
├── frontend/
│   ├── index.html          ← Login
│   ├── dashboard.html      ← Panel principal
│   ├── clientes.html       ← Gestión de clientes
│   ├── remesas.html        ← Conciliación
│   ├── resumen.html        ← Reportes
│   ├── css/
│   │   ├── variables.css   ← Variables de diseño
│   │   ├── base.css        ← Estilos base
│   │   ├── components.css  ← Componentes
│   │   └── [cada vista].css
│   └── js/
│       ├── api.js          ← Helper de API
│       ├── auth.js         ← Autenticación
│       ├── theme.js        ← Toggle tema
│       └── [cada vista].js
├── backend/
│   ├── server.js           ← Servidor Express
│   ├── config/
│   │   └── database.js     ← Conexión a BD
│   ├── middleware/
│   │   └── auth.js         ← JWT middleware
│   ├── routes/
│   │   ├── auth.js         ← Login/Register
│   │   ├── clientes.js     ← CRUD clientes
│   │   ├── ordenantes.js   ← CRUD ordenantes
│   │   ├── remesas.js      ← CRUD remesas
│   │   └── reportes.js     ← Reportes
│   └── db/
│       ├── schema.sql      ← Estructura BD
│       ├── seed.sql        ← Datos de prueba
│       ├── init.js         ← Script inicialización
│       └── seed.js         ← Script poblar datos
├── .env                    ← Variables de entorno
├── .gitignore
├── package.json
└── README.md
```

## 🔐 Seguridad

- Contraseñas hasheadas con bcrypt
- Autenticación JWT con expiración
- Rate limiting para prevenir abuso
- Helmet para headers de seguridad
- Auditoría de todos los cambios
- Consultas parametrizadas (prevenir SQL injection)

## 🎨 Diseño

- **Colores**: Negro (#0F0F0F) + Rojo (#DC2626)
- **Tipografía**: Bebas Neue (títulos) + Inter (cuerpo)
- **Tema**: Modo oscuro/claro con toggle
- **Responsive**: Se adapta a PC, tablet y móvil

## 📝 API Endpoints

### Auth
- `POST /api/auth/login` - Iniciar sesión
- `POST /api/auth/register` - Registrar usuario (admin)
- `POST /api/auth/forgot-password` - Recuperar contraseña
- `POST /api/auth/reset-password` - Restablecer contraseña
- `GET /api/auth/me` - Obtener usuario actual

### Clientes
- `GET /api/clientes` - Listar clientes
- `GET /api/clientes/:id` - Obtener cliente
- `POST /api/clientes` - Crear cliente
- `PUT /api/clientes/:id` - Actualizar cliente
- `DELETE /api/clientes/:id` - Eliminar cliente

### Ordenantes
- `GET /api/ordenantes/remesero/:remeseroId` - Ordenantes por remesero
- `GET /api/ordenantes/:id` - Obtener ordenante
- `POST /api/ordenantes` - Crear ordenante
- `PUT /api/ordenantes/:id` - Actualizar ordenante
- `DELETE /api/ordenantes/:id` - Eliminar ordenante

### Remesas
- `GET /api/remesas` - Listar remesas (con filtros)
- `GET /api/remesas/:id` - Obtener remesa
- `POST /api/remesas` - Crear remesa
- `PUT /api/remesas/:id` - Actualizar remesa
- `PUT /api/remesas/:id/confirmar` - Confirmar remesa
- `PUT /api/remesas/:id/desconfirmar` - Desconfirmar remesa
- `DELETE /api/remesas/:id` - Eliminar remesa

### Reportes
- `GET /api/reportes/resumen` - Resumen general
- `GET /api/reportes/por-periodo` - Reporte por período
- `GET /api/reportes/por-remesero` - Reporte por remesero
- `GET /api/reportes/pendientes` - Lista de pendientes

## 🚀 Deploy en Render

1. Crear cuenta en [render.com](https://render.com)
2. Conectar repositorio de GitHub
3. Configurar:
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
4. Agregar variables de entorno
5. ¡Listo!

## 📄 Licencia

ISC

---

Desarrollado con ❤️ para Bar Patio La China
