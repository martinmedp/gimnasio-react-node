# Sistema de gestión de gimnasio

Aplicación web para administrar un gimnasio: clientes, membresías y planes, asistencia con código QR, rutinas y ejercicios, medidas corporales, pagos, gastos, cierres de caja, estadísticas y respaldos.

## Tecnologías

- **Frontend:** React + Vite + TypeScript, Tailwind CSS, TanStack Query, React Router.
- **Backend:** Node.js + Express + TypeScript, Prisma 5.22 (ORM) y MySQL / MariaDB.

## Estructura

```
backend/    API (Express + Prisma)
frontend/   Aplicación web (React + Vite)
scripts/    Utilidades (respaldo.ps1 para respaldos desde Windows)
```

## Requisitos

- Node.js 22
- MySQL 8 o MariaDB (XAMPP en Windows ya incluye MariaDB)
- Git

## Instalación para desarrollo

**1. Descargar el proyecto**

```bash
git clone https://github.com/martinmedp/gimnasio-react-node.git
cd gimnasio-react-node
```

**2. Crear la base de datos vacía** (desde phpMyAdmin, o con `mysql`):

```sql
CREATE DATABASE gimnasio_db CHARACTER SET utf8mb4;
```

**3. Backend**

```bash
cd backend
npm install
cp .env.example .env
```

Abre `backend/.env` y completa los valores (ver "Variables de entorno"). Después:

```bash
npm run db:migrar     # crea todas las tablas
npm run db:seed       # crea los roles, catálogos básicos y el primer Administrador
npm run dev           # arranca el servidor en http://localhost:3000
```

Para que el seed cree el primer Administrador, define antes en `backend/.env`: `ADMIN_EMAIL`, `ADMIN_PASSWORD` (de 8 a 72 caracteres) y, si quieres, `ADMIN_NOMBRE`. Cuando termine, puedes borrar `ADMIN_PASSWORD` del archivo. El seed se puede ejecutar varias veces sin duplicar nada ni cambiar contraseñas existentes.

**4. Frontend** (en otra terminal)

```bash
cd frontend
npm install
npm run dev           # abre http://localhost:5173
```

El frontend usa `http://localhost:3000` como dirección del backend si no se indica otra. Solo necesitas un `frontend/.env` (copia de `.env.example`) si el backend está en otra dirección.

**5. Entrar** a http://localhost:5173 con el correo y la contraseña del Administrador.

## Variables de entorno

Los archivos `.env` **nunca** se suben a git (contienen secretos). Los `.env.example` son las plantillas.

| Variable | Dónde | Descripción |
|---|---|---|
| `DATABASE_URL` | backend | Conexión a MySQL: `mysql://usuario:clave@servidor:puerto/base` |
| `JWT_SECRET` | backend | Clave que firma las sesiones. Obligatoria, mínimo 32 caracteres. Genera una con `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| `FRONTEND_URL` | backend | Dirección del frontend (CORS), sin barra final. Obligatoria en producción |
| `PORT` | backend | Puerto del servidor (opcional, por defecto 3000) |
| `MYSQLDUMP_PATH` | backend | Ruta de `mysqldump` para los respaldos (opcional; por defecto la de XAMPP) |
| `ADMIN_NOMBRE`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` | backend | Solo para el seed |
| `VITE_API_URL` | frontend | Dirección del backend. Se incrusta en el código al compilar: no pongas secretos aquí |

**Importante:** el `.env` se lee **al arrancar**. Si lo cambias, reinicia el backend (o Vite, en el frontend). Un cambio de `JWT_SECRET` cierra todas las sesiones abiertas.

## Scripts

**Backend** (`cd backend`)

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo con recarga automática |
| `npm run build` | Genera el cliente de Prisma y compila a `dist/` |
| `npm start` | Ejecuta lo compilado (`dist/index.js`) |
| `npm run typecheck` | Revisa los tipos de TypeScript sin compilar |
| `npm run db:migrar` | Aplica las migraciones pendientes (`prisma migrate deploy`) |
| `npm run db:seed` | Crea roles, catálogos y el primer Administrador |

Si cambias `prisma/schema.prisma` durante el desarrollo: `npx prisma migrate dev --name descripcion_del_cambio`. Para ver los datos: `npx prisma studio`.

**Frontend** (`cd frontend`): `npm run dev`, `npm run build` (revisa tipos y empaqueta en `dist/`) y `npm run preview`.

## Roles y permisos

| Rol | Puede |
|---|---|
| **Administrador** | Todo: usuarios, anular pagos, revertir cierres, respaldos, estadísticas |
| **Recepcionista** | Crear y editar clientes, planes, membresías, pagos, asistencia, gastos y cierres. Solo consulta ejercicios y rutinas |
| **Entrenador** | Ver clientes; gestionar ejercicios, rutinas y medidas corporales |
| **Cliente** | Ver y gestionar lo suyo: perfil, medidas, rutina, membresía y asistencia |

Los clientes se auto-registran en `/registro`; su cuenta queda pendiente hasta que el Administrador la active.

## Respaldos

Un respaldo incluye la base de datos completa y las imágenes subidas, en un solo `.zip`. **Contiene los datos personales de todos los clientes: guárdalo en un lugar seguro.**

- **Desde la aplicación (Administrador):** menú **Respaldos**. Permite respaldar ahora, programar un respaldo diario y descargar (pide la contraseña). Se guardan en `backend/respaldos/` y se conservan los últimos 14. Si el equipo estaba apagado a la hora programada, el respaldo se hace al arrancar el backend.
- **Desde Windows (alternativa independiente de la aplicación):** `scripts/respaldo.ps1`, que guarda en `C:\respaldos-gimnasio`. Se puede programar con el Programador de tareas.
- **Segunda copia:** descarga de vez en cuando un respaldo y guárdalo fuera del equipo (USB o nube). Si el disco falla, los respaldos que están en él se pierden también.
- Los respaldos **no incluyen el archivo `.env`**: guárdalo aparte.

**Restaurar** (siempre es manual, a propósito):

1. Haz un respaldo del estado actual, por si algo sale mal.
2. Detén el backend y descomprime el `.zip` elegido.
3. Importa el `.sql` en una base vacía:
   ```bash
   mysql -u root -e "CREATE DATABASE gimnasio_restaurada CHARACTER SET utf8mb4"
   mysql -u root gimnasio_restaurada < gimnasio_db-AAAAMMDD-HHMMSS.sql
   ```
4. Revisa que los datos estén bien. Después apunta `DATABASE_URL` a esa base (o reemplaza la actual) y copia la carpeta `uploads/` del respaldo a `backend/uploads/`.

## Producción

**Backend**

```bash
cd backend
npm install
npm run build
npm run db:migrar
npm run db:seed        # solo la primera vez
npm start
```

Define `NODE_ENV=production` y todas las variables del backend. Con `NODE_ENV=production`, el sistema exige `FRONTEND_URL` y un `JWT_SECRET` de al menos 32 caracteres, y no arranca si faltan. Conviene ejecutarlo con un administrador de procesos (por ejemplo PM2) para que se reinicie solo.

**Frontend:** define `VITE_API_URL` con la dirección real del backend y ejecuta `npm run build`. Sirve la carpeta `frontend/dist/` con cualquier servidor web. La dirección se graba al compilar: si cambia, hay que volver a compilar.

**Usa HTTPS** en producción. La base de datos no debe usar el usuario `root` sin contraseña de XAMPP.

## Solución de problemas

| Síntoma | Causa y solución |
|---|---|
| `Can't reach database server at localhost:3306` | MySQL está apagado. Inícialo en el panel de XAMPP y revisa `C:\xampp\mysql\data\mysql_error.log` si no arranca. Antes de repararlo, copia la carpeta `C:\xampp\mysql\data` |
| Cambié el `.env` y no pasa nada | El `.env` se lee al arrancar: reinicia el backend (o Vite) |
| La app me lleva al login | La sesión venció (8 horas), la cuenta fue desactivada o se cambió `JWT_SECRET` |
| `429` al iniciar sesión | Demasiados intentos fallidos desde ese equipo. Esperar 15 minutos o reiniciar el backend |
| Las imágenes no se ven | Revisa que `VITE_API_URL` apunte al backend correcto y que `FRONTEND_URL` coincida con la dirección del frontend |
| La pantalla de login dice que no puede conectar | El backend está apagado o `VITE_API_URL` apunta a otro lugar. Reinicia Vite tras cambiar el `.env` |
| Aviso "Update available" de Prisma | Se ignora. Las versiones están fijadas a propósito (Prisma 5.22.0, TypeScript 5.6.3, zod 3, archiver 7 con `@types/archiver@6`). No las actualices sin probar |

## Pendientes conocidos

- Configurar `trust proxy` en Express si el backend queda detrás de un proxy inverso (para que el límite de intentos use la dirección real del visitante).
- Servir `/uploads` con autenticación (hoy las imágenes son públicas, aunque con nombres no adivinables).
- Aviso de tratamiento de datos personales en el registro (en Colombia aplica la Ley 1581 de 2012).
- Recuperación de contraseña por correo.
- Pruebas automáticas.