# GDP - SLEP Studio (portal)

Portal de acceso de **GDP - SLEP** (Gestión y Desarrollo de Personas para los SLEP).
Es la puerta de entrada: la persona se identifica una sola vez y desde acá elige a qué
aplicación ir. Las aplicaciones (Reporte Avance de Sumarios, Licencias Médicas, …) viven
**aparte**, cada una con su propia base de datos.

## Estado actual — Paso 1, parte A

Listo y probado en navegador real:

- Pantalla de ingreso institucional (logo DEP, "GDP - SLEP", botón **ClaveÚnica — Próximamente**
  y, debajo, el ingreso con usuario y contraseña).
- Pantalla de inicio con módulos como rectángulos y las aplicaciones adentro
  (Gestor de Formularios · Automatización de Procesos · Configuración).
- Cada persona ve solo lo que le corresponde (por módulo, por aplicación y por rol).
- Desactivar una cuenta bloquea al instante, incluso con la sesión abierta.

Todavía **no** incluye (siguientes pasos): las pantallas de Configuración (Usuarios y accesos,
Bitácora, Perfiles), el ingreso directo a Avance de Sumarios sin volver a escribir la clave
(SSO), la bitácora central, y ClaveÚnica real.

## Estructura

```
backend/    NestJS + TypeORM + MySQL   (puerto 3100)
frontend/   Angular 19 + Tailwind 4    (puerto 4300)
```

Los puertos son distintos a los de Avance de Sumarios, para poder tener ambos abiertos a la vez.

## Cómo correrlo en tu computador (Windows, `cmd`)

**1. Base de datos del portal** (una base nueva, distinta a la de Sumarios). En tu MySQL local:

```sql
CREATE DATABASE gdp_portal CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
GRANT ALL ON gdp_portal.* TO 'gdp_app'@'%';
```

**2. Backend**

```cmd
cd backend
copy .env.example .env
npm install
npm run migration:run
npm run seed
npm run start:dev
```

**3. Frontend** (en otra ventana de `cmd`)

```cmd
cd frontend
npm install
npm start
```

Abrir http://localhost:4300

## Personas de prueba

Las mismas 5 de Avance de Sumarios, con las mismas claves (usuario repetido):
`cesar` (Superadmin), `Claudia` y `Betania` (Admin), `Ximena` (Validador), `Barrancas` (Digitador).

> Solo para desarrollo. Antes de usar el portal en serio, cambiar estas claves.

## Tipografías oficiales

El manual de normas gráficas indica **gobCL** (titulares) y **Museo Sans** (texto). Los archivos
no vienen incluidos: descárgalos desde el enlace de la página 11 del manual, copia los `.woff2`
a `frontend/public/fonts/` y descomenta el bloque `@font-face` de `frontend/src/styles.css`.
Mientras tanto se usa la tipografía del sistema.

## Producción

- `frontend/src/environments/environment.prod.ts`: reemplazar la dirección del backend.
- `backend`: variables de entorno según `.env.example`. **`JWT_SECRET` largo y aleatorio.**
- `frontend/vercel.json` ya trae la salida y el redireccionamiento necesarios para Vercel.
