# CourseHub API

API de una institución que conserva cursos, estudiantes y sus matrículas.
Los tres módulos trabajan contra la misma base de datos PostgreSQL: una
matrícula es una fila que relaciona un estudiante con un curso, no un par de
números guardado en un arreglo.

```
Course 1 ──── * Enrollment * ──── 1 Student
```

## Requisitos

- Node.js 20 o superior (probado en Node 26).
- PostgreSQL en ejecución. La forma más rápida es el contenedor incluido:

```bash
docker compose up -d
```

Esto levanta PostgreSQL 17 en el puerto **5434** de tu máquina, con base
`coursehub-api`, usuario `postgres` y contraseña `postgres`. Si prefieres una
instalación local, crea la base a mano y ajusta `DATABASE_*` en tu `.env`.

## Configuración

Copia el archivo de ejemplo y edita los valores si tu entorno difiere:

```bash
cp .env.example .env
```

`.env` está en `.gitignore` y nunca debe publicarse. `.env.example` documenta
las claves sin valores reales.

| Variable | Para qué sirve |
| --- | --- |
| `NODE_ENV` | Ambiente: `development`, `test` o `production`. Por defecto `development`. Fuera de `development`, TypeORM deja de sincronizar el esquema. |
| `PORT` | Puerto de la API. Por defecto `3000`. |
| `DATABASE_HOST` | Host de PostgreSQL. Obligatoria. |
| `DATABASE_PORT` | Puerto de PostgreSQL. Por defecto `5432`. El contenedor lo publica en `5434`. |
| `DATABASE_NAME` | Nombre de la base. Obligatoria. |
| `DATABASE_USER` | Usuario de PostgreSQL. Obligatoria. |
| `DATABASE_PASSWORD` | Contraseña de PostgreSQL. Obligatoria (se admite vacía solo si el servidor la acepta). |
| `DATABASE_LOGGING` | Con `true` imprime las consultas SQL en la terminal. Por defecto `false`. Útil para aprender; déjalo en `false` fuera del desarrollo. |

`ConfigModule` valida estas variables con un esquema de **Joi** *antes* de
intentar conectar a PostgreSQL. Una variable ausente, un puerto no numérico o
un `NODE_ENV` desconocido detienen el arranque con un error que nombra la
variable culpable, en lugar de fallar de forma confusa más adelante.

## Puesta en marcha

```bash
npm install
npm run start:dev
```

La aplicación abre en `http://localhost:3000`.

## Esquema

Las tablas las crea TypeORM al arrancar, a partir de las entidades:

| Tabla | Contenido |
| --- | --- |
| `courses` | `id`, `title`, `level`. |
| `students` | `id`, `name`, `email`, `age`, `career`, `semester`, `isActive`. |
| `enrollments` | `id`, `student_id`, `course_id`. |

Dos restricciones las protege PostgreSQL, no solo el código:

- `students.email` es único. La API responde `409` y PostgreSQL rechaza el
  `INSERT` con el código `23505` si el servicio no llegara a comprobarlo.
- `(student_id, course_id)` es único en `enrollments`, de modo que la misma
  pareja no puede repetirse.

Ambas relaciones usan `ON DELETE RESTRICT`: no se puede borrar un estudiante o
un curso que todavía tenga matrículas. Cancelar la matrícula es una decisión
explícita (`DELETE /enrollments/:id`), nunca una consecuencia de borrar el
recurso.

`synchronize` se activa solo cuando `NODE_ENV=development`. Ajusta el esquema
a las entidades y es una comodidad de desarrollo local. En `production` queda
en `false`: el esquema debe cambiar mediante migraciones revisadas. La
decisión la toma el ambiente, no un valor escrito en TypeScript.

## Endpoints

### Cursos

| Método | Ruta | Respuesta |
| --- | --- | --- |
| `GET` | `/courses` | Lista paginada. Filtro `?level=`, `?page=`, `?limit=`, `?sortBy=`, `?order=`. |
| `GET` | `/courses/:id` | `404` si no existe. |
| `POST` | `/courses` | Crea uno. `level` debe ser `beginner`, `intermediate` o `advanced`. |
| `PATCH` | `/courses/:id` | Modifica solo los campos enviados. |
| `DELETE` | `/courses/:id` | `204`. `409` si tiene matrículas. |
| `GET` | `/courses/:courseId/enrollments` | Matrículas del curso con su estudiante. |

### Estudiantes

| Método | Ruta | Respuesta |
| --- | --- | --- |
| `GET` | `/students` | Lista todos. Filtros combinables `?career=`, `?semester=`, `?isActive=`. |
| `GET` | `/students/:id` | `404` si no existe. |
| `POST` | `/students` | Crea uno. `isActive` es opcional y por defecto `true`. |
| `PATCH` | `/students/:id` | Modifica solo los campos enviados. |
| `PATCH` | `/students/:id/status` | Activa o desactiva: `{ "isActive": false }`. |
| `DELETE` | `/students/:id` | `204`. `409` si está inactivo o tiene matrículas. |
| `GET` | `/students/:studentId/enrollments` | Matrículas del estudiante con su curso. |

### Matrículas

| Método | Ruta | Respuesta |
| --- | --- | --- |
| `POST` | `/enrollments` | Crea con `{ "studentId": 1, "courseId": 1 }`. |
| `GET` | `/enrollments` | Lista paginada con búsqueda. Ver parámetros abajo. |
| `DELETE` | `/enrollments/:id` | Cancela. `204`, o `404` si no existe. |

Las consultas de matrículas devuelven el estudiante y el curso relacionados,
porque una lista de identificadores sin contexto no es útil.

### Consultas de la Semana 6

`GET /courses` y `GET /enrollments` devuelven una forma estable con los
elementos de la página y sus metadatos, nunca la colección entera:

```json
{
  "items": [ { "id": 1, "title": "NestJS avanzado", "level": "beginner" } ],
  "meta": { "total": 8, "page": 1, "limit": 3, "totalPages": 3 }
}
```

| Endpoint | Parámetro | Para qué sirve |
| --- | --- | --- |
| `/courses` | `level` | Filtra por nivel exacto. |
| `/courses` | `page`, `limit` | Seleccionan la ventana. `limit` máximo `50`. |
| `/courses` | `sortBy=id\|title\|level`, `order=ASC\|DESC` | Orden estable de la página. |
| `/enrollments` | `search` | Búsqueda parcial por nombre de estudiante o título de curso (`ILIKE`, sin distinguir mayúsculas). |
| `/enrollments` | `studentId`, `courseId` | Filtros exactos, combinables entre sí y con `search`. |
| `/enrollments` | `activeOnly=true` | Solo matrículas de estudiantes activos. |
| `/enrollments` | `page`, `limit` | Paginación. `limit` máximo `50`. |

Reglas de seguridad y consistencia:

- `sortBy` **no** se usa como nombre de columna libre: se compara contra una
  lista cerrada (`id`, `title`, `level`) y cualquier otro valor responde `400`.
- `search` viaja como parámetro vinculado (`:search`), nunca interpolado en el
  SQL, de modo que una entrada como `' OR 1=1 --` se trata como texto.
- El orden por defecto (`enrollment.id`) hace reproducible el recorrido: dos
  páginas consecutivas no repiten ni saltan registros.
- Una búsqueda sin coincidencias responde `200` con `items: []` y `total: 0`,
  porque la colección existe aunque ninguna fila coincida.

Ejemplo:

```
GET /courses?level=beginner&page=2&limit=5&sortBy=title&order=ASC
GET /enrollments?search=nest&activeOnly=true&page=1&limit=5
```

### Códigos de error de la matrícula

`POST /enrollments` comprueba las reglas en este orden, para poder explicar el
motivo exacto del fallo:

| Situación | Código |
| --- | --- |
| El estudiante no existe | `404` |
| El curso no existe | `404` |
| El estudiante está inactivo | `400` |
| La pareja estudiante-curso ya existe | `409` |

Un `:id` que no sea un entero positivo produce `400`, no un error de base de
datos.

## Pruebas

```bash
npm test          # pruebas unitarias
npm run test:e2e  # pruebas de extremo a extremo contra PostgreSQL
npm run test:cov  # cobertura
```

Las pruebas e2e **no usan repositorios simulados**: hablan con la aplicación
completa por HTTP y con PostgreSQL de verdad, para comprobar que las claves
foráneas y los índices únicos funcionan realmente.

Para no mezclarse con los datos de desarrollo, cada suite usa tablas con
prefijo propio (`demo_`, `http_`, `query_`) y las elimina al terminar. Las
pruebas de `.env` usan la misma base de datos: si `DATABASE_NAME` no es válida,
fallarán antes de empezar.

### Los siete casos de la demostración

`test/demo.e2e-spec.ts` cubre la secuencia pedida en el enunciado:

1. Crea un curso y un estudiante activo.
2. Crea una matrícula válida y verifica sus dos relaciones.
3. Destruye y recrea la conexión: la matrícula sigue ahí.
4. Repetir la pareja devuelve `409`.
5. Matricular un estudiante inactivo devuelve `400`.
6. Filtra por estudiante, por curso y por ambos a la vez.
7. Cancela la matrícula y comprueba que ya no se encuentra.

Los casos 4 y 5 también atacan la base de datos por su cuenta, para
comprobar que el índice único y la clave foránea respaldan al servicio.

### Filtros, paginación y búsqueda (Semana 6)

`test/queries.e2e-spec.ts` comprueba por HTTP el contrato de la Semana 6:

- paginación con `items`/`meta`, `totalPages` y recorrido de dos páginas sin
  repetir registros;
- filtro por `level`, orden `ASC`/`DESC` y los cuatro parámetros inválidos
  (`page=0`, `limit=200`, `sortBy` no permitido, `order` distinto de `ASC`/`DESC`)
  respondiendo `400`;
- búsqueda `ILIKE` parcial sobre estudiante y curso, combinada con filtros y
  paginación, con `200` y lista vacía cuando no hay coincidencias;
- un intento de inyección SQL (`' OR 1=1 --`) tratado como texto.

## Estructura

```
src/
├── app.module.ts              ConfigModule y TypeOrmModule
├── main.ts                    ValidationPipe global y CORS
├── common/pipes/              ParseIntPipe reutilizable
├── courses/                   Entidad, DTOs, servicio y controlador
├── students/                  Entidad, DTOs, servicio y controlador
└── enrollments/               Entidad, DTOs, reglas de negocio
```

Los controladores se limitan a rutas, parámetros y DTOs. Las reglas viven en
los servicios; los DTOs validan la entrada y las entidades describen cómo se
guarda la información. Son responsabilidades distintas y no se mezclan.