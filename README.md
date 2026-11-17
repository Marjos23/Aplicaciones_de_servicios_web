# CourseHub API — Cursos, Estudiantes y Matrículas

API REST desarrollada con **NestJS** que integra el módulo de **Cursos** (rama `main`),
la **Gestión de estudiantes** (rama `gestion-estudiantes`) y un nuevo módulo de
**Matrículas** (`EnrollmentsModule`).

> **Alcance:** todo el estado se administra en **listas en memoria**. No se utiliza
> PostgreSQL, TypeORM, entidades ni repositorios.

---

## 1. Requisitos

- Node.js 20 o superior
- npm

## 2. Instalación y ejecución

```bash
npm install
npm run start        # ejecuta la API en http://localhost:3000
# o en modo desarrollo:
npm run start:dev
```

Pruebas y calidad de código:

```bash
npm test             # pruebas unitarias (vitest)
npm run test:e2e     # pruebas e2e de cursos, estudiantes y matrículas
npm run build        # compila a dist/
npm run lint         # análisis estático (oxlint)
```

Para reproducir la demostración de todos los casos (con la API en ejecución):

```bash
bash docs/demostracion.sh
```

---

## 3. Estructura del proyecto

```
src/
├── main.ts                     # ValidationPipe global (whitelist + forbidNonWhitelisted)
├── app.module.ts               # registra CoursesModule, StudentsModule y EnrollmentsModule
├── app.controller.ts / app.service.ts
├── common/
│   └── pipes/
│       └── parse-positive-int.pipe.ts   # Pipe personalizado para ids de ruta
├── courses/
│   ├── courses.module.ts
│   ├── courses.controller.ts
│   ├── courses.service.ts      # lista en memoria + IDs consecutivos
│   └── dto/
│       ├── create-course.dto.ts
│       └── update-course.dto.ts
├── students/
│   ├── students.module.ts
│   ├── students.controller.ts
│   ├── students.service.ts     # lista en memoria + bandera `active`
│   └── dto/
│       ├── create-student.dto.ts
│       └── update-student.dto.ts
└── enrollments/
    ├── enrollments.module.ts
    ├── enrollments.controller.ts
    ├── enrollments.service.ts  # reglas de negocio de matrícula
    └── dto/
        ├── create-enrollment.dto.ts
        └── enrollment-query.dto.ts
```

---

## 4. Git: merge verificable

La integración se realizó desde `main` incorporando la rama alternativa. El historial
completo se puede revisar con:

```bash
git log --graph --oneline --all
git branch -a
```

Secuencia verificable:

```text
*   merge: integrar gestion-estudiantes en main conservando Cursos y Estudiantes
|\
| * feat(students): módulo de gestión de estudiantes en memoria
* | feat(courses): módulo de cursos en memoria
|/
* chore: configurar proyecto base CourseHub API y pipe ParsePositiveInt
```

El merge produjo un conflicto en `src/app.module.ts` (ambas ramas registraban su
módulo) que se resolvió conservando **Cursos y Estudiantes** y, posteriormente, se
agregó **Matrículas**.

---

## 5. Endpoints

### Cursos

| Método | Ruta            | Descripción                    |
|--------|-----------------|--------------------------------|
| POST   | `/courses`      | Crea un curso                  |
| GET    | `/courses`      | Lista todos los cursos         |
| GET    | `/courses/:id`  | Obtiene un curso por id        |
| PATCH  | `/courses/:id`  | Actualiza un curso             |
| DELETE | `/courses/:id`  | Elimina un curso               |

### Estudiantes

| Método | Ruta             | Descripción                       |
|--------|------------------|-----------------------------------|
| POST   | `/students`      | Crea un estudiante                |
| GET    | `/students`      | Lista todos los estudiantes       |
| GET    | `/students/:id`  | Obtiene un estudiante por id      |
| PATCH  | `/students/:id`  | Actualiza un estudiante           |
| DELETE | `/students/:id`  | Elimina un estudiante             |

### Matrículas

| Método | Ruta                                   | Descripción                                             |
|--------|----------------------------------------|---------------------------------------------------------|
| POST   | `/enrollments`                         | Registra una matrícula                                  |
| GET    | `/enrollments`                         | Lista matrículas; filtros opcionales `studentId`, `courseId` |
| GET    | `/students/:studentId/enrollments`     | Matrículas de un estudiante                             |
| GET    | `/courses/:courseId/enrollments`       | Matrículas de un curso                                  |
| DELETE | `/enrollments/:id`                     | Cancela una matrícula                                   |

**Códigos HTTP:** `200` consulta/actualización, `201` creación, `400` datos inválidos o
estudiante inactivo, `404` recurso inexistente, `409` matrícula duplicada.

---

## 6. Reglas de negocio (en el servicio)

Al registrar una matrícula (`POST /enrollments`) el `EnrollmentsService` verifica, en
orden:

1. Que el **estudiante exista** → si no, `404 Not Found`.
2. Que el **curso exista** → si no, `404 Not Found`.
3. Que el **estudiante esté activo** (`active === true`) → si no, `400 Bad Request`.
4. Que **no exista** ya la combinación `studentId` + `courseId` → si no, `409 Conflict`.

El controlador no contiene reglas de negocio: solo delega en el servicio.
La validación de entrada se resuelve con `CreateEnrollmentDto` + `ValidationPipe` global
(`whitelist` y `forbidNonWhitelisted`), y los ids de ruta se transforman/validan con el
`ParsePositiveIntPipe` personalizado.

---

## 7. Ejemplos de request y response

### 7.1 Matrícula válida

```http
POST /enrollments
Content-Type: application/json

{ "studentId": 1, "courseId": 2 }
```

`201 Created`

```json
{ "id": 2, "studentId": 1, "courseId": 2 }
```

### 7.2 Matrícula duplicada

Misma combinación `studentId` + `courseId` ya registrada:

`409 Conflict`

```json
{
  "message": "El estudiante 1 ya está matriculado en el curso 2",
  "error": "Conflict",
  "statusCode": 409
}
```

### 7.3 Estudiante inactivo

```http
POST /enrollments

{ "studentId": 3, "courseId": 1 }
```

`400 Bad Request`

```json
{
  "message": "El estudiante con id 3 no está activo",
  "error": "Bad Request",
  "statusCode": 400
}
```

### 7.4 Estudiante o curso inexistente

```http
POST /enrollments

{ "studentId": 999, "courseId": 1 }
```

`404 Not Found`

```json
{
  "message": "Estudiante con id 999 no encontrado",
  "error": "Not Found",
  "statusCode": 404
}
```

`DELETE /enrollments/999` → `404 Not Found`.

### 7.5 Identificador de ruta inválido (Pipe personalizado)

`GET /courses/abc` → `400 Bad Request`

```json
{
  "message": "El identificador \"NaN\" debe ser un número entero positivo",
  "error": "Bad Request",
  "statusCode": 400
}
```

### 7.6 Validación del DTO (whitelist / forbidNonWhitelisted)

```http
POST /enrollments

{ "studentId": 1, "courseId": 1, "hack": true }
```

`400 Bad Request`

```json
{ "message": ["property hack should not exist"], "error": "Bad Request", "statusCode": 400 }
```

### 7.7 Filtros combinables

```http
GET /enrollments?studentId=1&courseId=1
```

`200 OK`

```json
[ { "id": 1, "studentId": 1, "courseId": 1 } ]
```

### 7.8 Consultas anidadas y cancelación

```http
GET  /students/1/enrollments      -> 200 [ ... matrículas del estudiante 1 ]
GET  /courses/1/enrollments       -> 200 [ ... matrículas del curso 1 ]
DELETE /enrollments/1             -> 200 { "id": 1, "studentId": 1, "courseId": 1 }
```

Tras la cancelación, `GET /enrollments` ya no devuelve la matrícula eliminada.

---

## 8. Evidencias

| Archivo                        | Contenido                                                        |
|--------------------------------|------------------------------------------------------------------|
| `test/enrollments.e2e-spec.ts` | 9 pruebas automatizadas: alta, duplicado, inactivo, inexistente, filtros, consultas anidadas, cancelación, pipe y DTO |
| `test/app.e2e-spec.ts`         | Prueba e2e del endpoint raíz                                     |
| `docs/demostracion.sh`         | Script reproducible de todos los casos                            |
| `docs/DEMOSTRACION.txt`        | Salida real: válida, duplicada, inactivo, inexistente, filtros y cancelación |
| `docs/ARRANQUE.txt`            | Log de arranque con los tres módulos y todas las rutas mapeadas   |

Resultado de `npm run test:e2e`: **2 archivos, 10 pruebas, todas aprobadas**.

Datos semilla (en memoria):

- Cursos: `1` Aplicaciones para el servidor web, `2` Bases de Datos Avanzadas.
- Estudiantes: `1` Ana Torres (activa), `2` Luis Pérez (activo), `3` Mariana Gómez (**inactiva**).
- Matrícula inicial: `{ id: 1, studentId: 1, courseId: 1 }`.
