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

| Variable            | Para qué sirve                                                                                                                                  |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `NODE_ENV`          | Ambiente: `development`, `test` o `production`. Por defecto `development`. Fuera de `development`, TypeORM deja de sincronizar el esquema.      |
| `PORT`              | Puerto de la API. Por defecto `3000`.                                                                                                           |
| `DATABASE_HOST`     | Host de PostgreSQL. Obligatoria.                                                                                                                |
| `DATABASE_PORT`     | Puerto de PostgreSQL. Por defecto `5432`. El contenedor lo publica en `5434`.                                                                   |
| `DATABASE_NAME`     | Nombre de la base. Obligatoria.                                                                                                                 |
| `DATABASE_USER`     | Usuario de PostgreSQL. Obligatoria.                                                                                                             |
| `DATABASE_PASSWORD` | Contraseña de PostgreSQL. Obligatoria (se admite vacía solo si el servidor la acepta).                                                          |
| `DATABASE_LOGGING`  | Con `true` imprime las consultas SQL en la terminal. Por defecto `false`. Útil para aprender; déjalo en `false` fuera del desarrollo.           |
| `JWT_SECRET`        | Secreto con el que se firman los tokens. Obligatorio, mínimo 32 caracteres. Nunca se publica: solo vive en `.env` o en el entorno del servidor. |
| `JWT_EXPIRES_IN`    | Vigencia del token, por defecto `15m`.                                                                                                          |
| `CORS_ORIGINS`      | Orígenes web autorizados, separados por comas. Por defecto `http://localhost:5173`. En producción se declaran explícitamente.                   |

`ConfigModule` valida estas variables con un esquema de **Joi** _antes_ de
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

| Tabla         | Contenido                                                                                                   |
| ------------- | ----------------------------------------------------------------------------------------------------------- |
| `courses`     | `id`, `title`, `level`, `created_by_user_id` (propietario; `NULL` en cursos creados antes de la semana 10). |
| `students`    | `id`, `name`, `email`, `age`, `career`, `semester`, `isActive`.                                             |
| `enrollments` | `id`, `student_id`, `course_id`.                                                                            |
| `users`       | `id`, `email`, `passwordHash`, `role` (`admin`, `teacher` o `student`).                                     |

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

### Autenticación y autorización

| Método | Ruta             | Acceso                                | Respuesta                                                |
| ------ | ---------------- | ------------------------------------- | -------------------------------------------------------- |
| `POST` | `/auth/register` | Público                               | Crea una cuenta con rol `student` por defecto.           |
| `POST` | `/auth/login`    | Público, máximo 5 intentos por minuto | Devuelve `accessToken` y los datos mínimos del usuario.  |
| `GET`  | `/auth/me`       | JWT                                   | Devuelve `id`, `email` y `role` del usuario autenticado. |

El token se envía como `Authorization: Bearer <token>`. Un token ausente,
alterado o vencido produce `401`; una identidad válida sin el rol o la
propiedad necesarios produce `403`. `JwtAuthGuard` corre primero y deja
`req.user`; `RolesGuard` lee después la política declarada con `@Roles()`.

Los roles se asignan de forma controlada en la base local; el registro público
nunca puede crear un administrador:

```bash
docker compose exec -T postgres psql -U postgres -d coursehub-api \
  -c "UPDATE users SET role = 'admin' WHERE email = 'admin@example.com';"
docker compose exec -T postgres psql -U postgres -d coursehub-api \
  -c "UPDATE users SET role = 'teacher' WHERE email = 'teacher@example.com';"
```

El rol se consulta en la base en cada petición, por lo que un cambio de rol
surte efecto sin esperar a que venza el token.

### Cursos

| Método   | Ruta                             | Respuesta                                                                     |
| -------- | -------------------------------- | ----------------------------------------------------------------------------- |
| `GET`    | `/courses`                       | Lista paginada. Filtro `?level=`, `?page=`, `?limit=`, `?sortBy=`, `?order=`. |
| `GET`    | `/courses/:id`                   | `404` si no existe.                                                           |
| `POST`   | `/courses`                       | Crea uno. `level` debe ser `beginner`, `intermediate` o `advanced`.           |
| `PATCH`  | `/courses/:id`                   | Modifica solo los campos enviados.                                            |
| `DELETE` | `/courses/:id`                   | `204`. `409` si tiene matrículas.                                             |
| `GET`    | `/courses/:courseId/enrollments` | Matrículas del curso con su estudiante.                                       |

`POST` y `PATCH /courses` requieren JWT y rol `admin` o `teacher`. En `PATCH`
un `teacher` solo puede modificar los cursos cuyo `createdByUserId` es su
`id`; un docente ajeno recibe `403`. `DELETE /courses/:id` es exclusivo de
`admin`. Las lecturas siguen siendo públicas.

### Estudiantes

| Método   | Ruta                               | Respuesta                                                                |
| -------- | ---------------------------------- | ------------------------------------------------------------------------ |
| `GET`    | `/students`                        | Lista todos. Filtros combinables `?career=`, `?semester=`, `?isActive=`. |
| `GET`    | `/students/:id`                    | `404` si no existe.                                                      |
| `POST`   | `/students`                        | Crea uno. `isActive` es opcional y por defecto `true`.                   |
| `PATCH`  | `/students/:id`                    | Modifica solo los campos enviados.                                       |
| `PATCH`  | `/students/:id/status`             | Activa o desactiva: `{ "isActive": false }`.                             |
| `DELETE` | `/students/:id`                    | `204`. `409` si está inactivo o tiene matrículas.                        |
| `GET`    | `/students/:studentId/enrollments` | Matrículas del estudiante con su curso.                                  |

Todas las escrituras de estudiantes requieren JWT y rol `admin` o `teacher`.

### Matrículas

| Método   | Ruta               | Respuesta                                          |
| -------- | ------------------ | -------------------------------------------------- |
| `POST`   | `/enrollments`     | Crea con `{ "studentId": 1, "courseId": 1 }`.      |
| `GET`    | `/enrollments`     | Lista paginada con búsqueda. Ver parámetros abajo. |
| `DELETE` | `/enrollments/:id` | Cancela. `204`, o `404` si no existe.              |

Las consultas de matrículas devuelven el estudiante y el curso relacionados,
porque una lista de identificadores sin contexto no es útil. Crear y cancelar
matrículas requiere JWT y rol `admin` o `teacher`.

### Consultas de la Semana 6

`GET /courses` y `GET /enrollments` devuelven una forma estable con los
elementos de la página y sus metadatos, nunca la colección entera:

```json
{
  "items": [{ "id": 1, "title": "NestJS avanzado", "level": "beginner" }],
  "meta": { "total": 8, "page": 1, "limit": 3, "totalPages": 3 }
}
```

| Endpoint       | Parámetro                                    | Para qué sirve                                                                                    |
| -------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `/courses`     | `level`                                      | Filtra por nivel exacto.                                                                          |
| `/courses`     | `page`, `limit`                              | Seleccionan la ventana. `limit` máximo `50`.                                                      |
| `/courses`     | `sortBy=id\|title\|level`, `order=ASC\|DESC` | Orden estable de la página.                                                                       |
| `/enrollments` | `search`                                     | Búsqueda parcial por nombre de estudiante o título de curso (`ILIKE`, sin distinguir mayúsculas). |
| `/enrollments` | `studentId`, `courseId`                      | Filtros exactos, combinables entre sí y con `search`.                                             |
| `/enrollments` | `activeOnly=true`                            | Solo matrículas de estudiantes activos.                                                           |
| `/enrollments` | `page`, `limit`                              | Paginación. `limit` máximo `50`.                                                                  |

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

| Situación                            | Código |
| ------------------------------------ | ------ |
| El estudiante no existe              | `404`  |
| El curso no existe                   | `404`  |
| El estudiante está inactivo          | `400`  |
| La pareja estudiante-curso ya existe | `409`  |

Un `:id` que no sea un entero positivo produce `400`, no un error de base de
datos.

## Defensa en profundidad (Semana 10)

| Capa      | Control                                  | Qué cubre                                                     |
| --------- | ---------------------------------------- | ------------------------------------------------------------- |
| Identidad | JWT firmado con `JWT_SECRET`             | `401` si falta, está alterado o venció.                       |
| Acción    | `RolesGuard` + comprobación de propiedad | `403` si el rol o la propiedad no bastan.                     |
| Entrada   | DTO y `ValidationPipe`                   | `400` ante campos inválidos o desconocidos.                   |
| Navegador | CORS con `CORS_ORIGINS`                  | Solo esos orígenes pueden leer respuestas desde el navegador. |
| Abuso     | `@Throttle` en `POST /auth/login`        | `429` tras 5 intentos por minuto.                             |
| Tránsito  | HTTPS/TLS en producción                  | Evita interceptar el token Bearer en la red.                  |

CORS **no** es autorización: Postman, un script o un servidor externo no
están sujetos a CORS, por lo que las rutas siguen exigiendo JWT y controles en
el servidor. La respuesta `429` no revela si el correo o la contraseña eran
correctos.

**Producción:** la API debe servirse detrás de HTTPS/TLS (terminación en un
proxy, balanceador o plataforma de despliegue). Los secretos —`JWT_SECRET` y
las credenciales de base de datos— viven solo en el entorno del servidor;
nunca en el repositorio, el token ni los logs.

### Los cinco casos de la autorización

Sobre una misma ruta, por ejemplo `PATCH /courses/:id` de un curso creado por
el docente:

| Identidad              | Resultado | Motivo                                          |
| ---------------------- | --------- | ----------------------------------------------- |
| Sin token              | `401`     | No hay identidad válida.                        |
| Estudiante autenticado | `403`     | Su rol no está en `@Roles(admin, teacher)`.     |
| Docente ajeno          | `403`     | El curso pertenece a otro usuario.              |
| Docente propietario    | `200`     | Rol válido y `createdByUserId` coincide.        |
| Administrador          | `200`     | El rol `admin` puede gestionar cualquier curso. |

Para repetir la demostración con `curl`, guarda primero los tokens de cada
cuenta y también el `id` de un curso creado por la docente:

```bash
token() {
  curl -s -X POST http://localhost:3000/auth/login \
    -H 'Content-Type: application/json' \
    -d "{\"email\":\"$1\",\"password\":\"$2\"}" |
    node -pe "JSON.parse(require('fs').readFileSync(0,'utf8')).accessToken"
}
ADMIN=$(token admin@example.com 'Password123!')
TEACHER=$(token teacher@example.com 'Password123!')
OTHER=$(token other@example.com 'Password123!')
STUDENT=$(token student@example.com 'Password123!')

curl -i -X PATCH http://localhost:3000/courses/1 \
  -H 'Content-Type: application/json' -H "Authorization: Bearer $STUDENT" \
  -d '{"title":"Sin permiso"}'
```

Repite la última petición con `$OTHER`, `$TEACHER` y `$ADMIN`. Para
`DELETE /courses/:id` usa `$ADMIN`: cualquier otro token válido recibe `403`.

## Arquitectura y componentes transversales (Semana 11)

Cada componente transversal se registra una sola vez en `AppModule` y actúa en
su etapa, sin repetir código en los controladores:

| Componente                        | Momento                    | Responsabilidad                                                                                                                   |
| --------------------------------- | -------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `RequestLoggerMiddleware`         | Antes del controlador      | Asigna `X-Request-Id` y registra método, ruta, estado y duración. Nunca registra `Authorization`, tokens, contraseñas ni cuerpos. |
| `JwtAuthGuard` / `RolesGuard`     | Antes del controlador      | Deciden si la petición continúa.                                                                                                  |
| `ValidationPipe` / `ParseIntPipe` | Antes del método           | Validan el cuerpo y convierten el `:id`.                                                                                          |
| `TimingInterceptor`               | Antes y después del método | Mide la duración, añade `X-Response-Time` y la registra sin tocar la regla de negocio.                                            |
| `AllExceptionsFilter`             | Ante una excepción         | Traduce cualquier error a una respuesta HTTP uniforme.                                                                            |

```json
{
  "statusCode": 404,
  "message": "Course with id 999999 not found",
  "path": "/courses/999999",
  "timestamp": "2026-11-24T02:00:00.000Z",
  "requestId": "7b0e1c22-7e0a-4b2a-8e5c-2f9d6a1b4c3f"
}
```

Un error inesperado responde `500` con `message: "Internal server error"`: la
traza, la consulta SQL y las variables de entorno quedan solo en los registros
internos controlados, nunca en la respuesta pública.

`PATCH /courses/:id` quedó separado en capas:

```
CoursesController (HTTP)
  → UpdateCourseUseCase (regla de negocio y propiedad)
  → CourseRepository (puerto: findById y save)
  → TypeOrmCourseRepository (adaptador)
  → PostgreSQL
```

El controlador conoce rutas y DTOs; el caso de uso no importa HTTP ni TypeORM y
decide si el actor puede modificar el curso; el puerto pide solo los dos
métodos que la regla necesita; el adaptador traduce ese contrato a TypeORM.
Cambiar la regla «solo el propietario edita» toca el caso de uso; cambiar de ORM
toca el adaptador. La autorización de propiedad vive con la regla, no en el
controlador.

La demostración de la Etapa 3 muestra cuatro peticiones con `curl -i`:

```bash
curl -i http://localhost:3000/courses                         # 200, correcta
curl -i http://localhost:3000/courses/abc                     # 400, id inválido
curl -i http://localhost:3000/courses/999999                  # 404, inexistente
curl -i -X PATCH http://localhost:3000/courses/1 \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $STUDENT" -d '{"title":"Sin permiso"}'  # 403
```

En cada respuesta se ven `X-Request-Id`, `X-Response-Time` y el mismo formato
de error. En el código: HTTP en `src/courses/courses.controller.ts`, la regla en
`src/courses/use-cases/update-course.use-case.ts` y la persistencia en
`src/courses/adapters/typeorm-course.repository.ts`.

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

### Autorización y seguridad (Semana 10)

`test/authorization.e2e-spec.ts` comprueba por HTTP: `/auth/me` con token
válido, ausente y alterado; el rol por defecto `student`; la matriz de cinco
casos sobre `PATCH /courses/:id`; `DELETE` exclusivo de `admin`; que el
propietario no se toma del cuerpo; `429` en el sexto intento de login; y que
solo el origen CORS documentado recibe la cabecera de respuesta.

### Arquitectura y transversales (Semana 11)

`test/update-course.use-case.spec.ts` prueba la regla de propiedad con un
repositorio falso, sin HTTP ni PostgreSQL. `test/observability.e2e-spec.ts`
comprueba por HTTP los cuatro casos de la demostración, la forma uniforme de los
errores, la ausencia de trazas o secretos en la respuesta y que los registros no
contienen credenciales ni cuerpos.

## Estructura

```
src/
├── app.module.ts              Config, TypeORM, guards, filter e interceptor
├── main.ts                    ValidationPipe global y CORS por entorno
├── auth/                      Login con JWT, guard, roles y /auth/me
├── users/                     Entidad User con rol controlado
├── common/
│   ├── filters/               AllExceptionsFilter
│   ├── interceptors/          TimingInterceptor
│   ├── middleware/            RequestLoggerMiddleware
│   └── pipes/                 ParseIntPipe reutilizable
├── courses/
│   ├── adapters/              TypeOrmCourseRepository
│   ├── ports/                 CourseRepository
│   ├── use-cases/             UpdateCourseUseCase
│   └── entidad, DTOs, servicio y controlador
├── students/                  Entidad, DTOs, servicio y controlador
└── enrollments/               Entidad, DTOs, reglas de negocio
```

Los controladores se limitan a rutas, parámetros y DTOs. Las reglas viven en
los servicios o en casos de uso; los DTOs validan la entrada y las entidades
describen cómo se guarda la información. Son responsabilidades distintas y no
se mezclan.
