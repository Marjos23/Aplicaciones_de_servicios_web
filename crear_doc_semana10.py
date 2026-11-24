from datetime import datetime
from pathlib import Path

from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.shared import Inches, Pt

BASE_DIR = Path(__file__).resolve().parent
IMAGENES = BASE_DIR / 'docs' / 'evidencia-semana-10'

doc = Document()

titulo = doc.add_heading('Semana 10 · Autorización y seguridad de acceso', 0)
titulo.alignment = WD_ALIGN_PARAGRAPH.CENTER

p = doc.add_paragraph()
p.alignment = WD_ALIGN_PARAGRAPH.CENTER
p.add_run('Curso: Aplicaciones de Servicios Web\n')
p.add_run('Sesiones 19 y 20 · CourseHub API\n')
p.add_run(f'Fecha: {datetime.now().strftime("%d/%m/%Y")}')

doc.add_page_break()


def codigo(texto):
    parrafo = doc.add_paragraph()
    run = parrafo.add_run(texto)
    run.font.name = 'Courier New'
    run.font.size = Pt(8)
    return parrafo


def tabla(cabeceras, filas):
    table = doc.add_table(rows=1, cols=len(cabeceras))
    table.style = 'Table Grid'
    for celda, texto in zip(table.rows[0].cells, cabeceras):
        celda.text = texto
        for run in celda.paragraphs[0].runs:
            run.bold = True
    for fila in filas:
        celdas = table.add_row().cells
        for celda, texto in zip(celdas, fila):
            celda.text = str(texto)
    return table


def imagen(nombre, pie):
    doc.add_picture(str(IMAGENES / nombre), width=Inches(6.0))
    pie_parrafo = doc.add_paragraph()
    pie_parrafo.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = pie_parrafo.add_run(pie)
    run.italic = True
    run.font.size = Pt(9)


doc.add_heading('1. Alcance verificado', level=1)
for req in [
    'User tiene un rol controlado y el valor por defecto es el de menor privilegio.',
    'Existe una ruta exclusiva de administración protegida por JWT y rol; una identidad válida sin rol recibe 403.',
    'Existe una regla de propiedad en una operación de actualización: un docente no modifica el curso de otro docente.',
    'CORS admite únicamente los orígenes documentados para el entorno.',
    'POST /auth/login tiene limitación de solicitudes y responde 429 cuando se excede.',
    'El README declara HTTPS/TLS como requisito de producción.',
]:
    doc.add_paragraph(req, style='List Bullet')

doc.add_heading('2. Ambiente de ejecución', level=1)
doc.add_paragraph('Aplicación iniciada en modo development con NODE_ENV=development.')
doc.add_paragraph(
    'PostgreSQL 17 levantado con Docker en el contenedor coursehub_db, '
    'puerto 5434 y base coursehub-api. Fuera de development, TypeORM deja '
    'de sincronizar el esquema.'
)
doc.add_paragraph(
    'Cuentas de práctica creadas solo en la base local. El registro público '
    'siempre crea cuentas con rol student; los roles de práctica se asignaron '
    'de forma controlada mediante SQL, sin exponer contraseñas ni tokens.'
)

doc.add_heading('3. Rol controlado y menor privilegio', level=1)
codigo(
    "export enum UserRole {\n"
    "  ADMIN = 'admin',\n"
    "  TEACHER = 'teacher',\n"
    "  STUDENT = 'student',\n"
    "}\n\n"
    "@Column({ type: 'enum', enum: UserRole, default: UserRole.STUDENT })\n"
    "role: UserRole;"
)
doc.add_paragraph(
    'La enumeración cierra los valores posibles y el valor por defecto es '
    'student. RegisterDto no acepta el campo role: ValidationPipe rechaza '
    'cualquier propiedad desconocida con 400.'
)
codigo(
    "docker exec coursehub_db psql -U postgres -d coursehub-api \\\n"
    "  -c \"UPDATE users SET role = 'admin' WHERE email = 'admin@example.com';\""
)
doc.add_paragraph('Evidencia observada en GET /auth/me:')
codigo(
    'admin  -> {"id":15,"email":"...","role":"admin"}\n'
    'estudiante -> {"id":18,"email":"...","role":"student"}'
)
imagen('roles.png', 'Imagen 1. Respuesta de /auth/me para una cuenta admin y una student.')
doc.add_paragraph(
    'El rol se consulta en la base en cada solicitud, por lo que un cambio '
    'de rol surte efecto sin esperar a que venza el token.'
)

doc.add_heading('4. Ruta exclusiva de administración', level=1)
codigo(
    "@Delete(':id')\n"
    "@HttpCode(HttpStatus.NO_CONTENT)\n"
    "@UseGuards(JwtAuthGuard, RolesGuard)\n"
    "@Roles(UserRole.ADMIN)\n"
    "remove(@Param('id', ParseIntPipe) id: number) {\n"
    "  return this.coursesService.remove(id);\n"
    "}"
)
doc.add_paragraph(
    'JwtAuthGuard verifica la identidad y deja req.user; RolesGuard lee '
    'después la política declarada con @Roles(). Un token ausente produce '
    '401; un token válido de docente o estudiante produce 403.'
)
tabla(
    ['Petición', 'Identidad', 'Resultado'],
    [
        ['DELETE /courses/9', 'Docente propietario', '403 Forbidden'],
        ['DELETE /courses/9', 'Administrador', '204 No Content'],
        ['PATCH /courses/9', 'Estudiante', '403 Forbidden'],
    ],
)
doc.add_paragraph(
    'La ruta de administración no depende del cliente: la decisión se toma '
    'en los guards del servidor antes de llegar al servicio.'
)

doc.add_heading('5. Propiedad de recursos', level=1)
codigo(
    "@Column({ type: 'int', nullable: true })\n"
    "createdByUserId: number | null;\n\n"
    "private assertCanManage(course: Course, actor: AuthenticatedUser): void {\n"
    "  if (actor.role === UserRole.ADMIN) return;\n"
    "  if (actor.role === UserRole.TEACHER &&\n"
    "      course.createdByUserId === actor.id) return;\n"
    "  throw new ForbiddenException('You cannot modify this course');\n"
    "}"
)
doc.add_paragraph(
    'El propietario se toma del usuario autenticado al crear el curso y '
    'nunca del cuerpo HTTP. En la demostración, POST /courses con token de '
    'docente devolvió:'
)
codigo('{"id":9,"title":"Curso propiedad docente","level":"beginner","createdByUserId":16}')
doc.add_paragraph(
    'Un cuerpo con createdByUserId ajeno es rechazado con 400 por '
    'forbidNonWhitelisted, porque ese campo no pertenece al DTO.'
)
doc.add_paragraph('Matriz de los cinco casos sobre PATCH /courses/9:')
tabla(
    ['Identidad', 'Código', 'Motivo'],
    [
        ['Sin token', '401', 'No hay identidad válida.'],
        ['Estudiante', '403', 'Su rol no está en @Roles(admin, teacher).'],
        ['Docente ajeno', '403', 'El curso pertenece a otro usuario.'],
        ['Docente propietario', '200', 'Rol válido y createdByUserId coincide.'],
        ['Administrador', '200', 'El rol admin gestiona cualquier curso.'],
    ],
)
imagen('propiedad.png', 'Imagen 2. Creación del curso, matriz de PATCH y resultado de DELETE.')

doc.add_heading('6. CORS restringido', level=1)
codigo(
    "export function corsOptions(config: ConfigService): CorsOptions {\n"
    "  const origin = config.getOrThrow<string>('CORS_ORIGINS')\n"
    "    .split(',').map((entry) => entry.trim()).filter(Boolean);\n"
    "  return {\n"
    "    origin,\n"
    "    methods: ['GET', 'POST', 'PATCH', 'DELETE'],\n"
    "    allowedHeaders: ['Content-Type', 'Authorization'],\n"
    "  };\n"
    "}"
)
doc.add_paragraph(
    'La variable CORS_ORIGINS se documenta en .env.example y en el README. '
    'El valor por defecto para desarrollo es http://localhost:5173; en '
    'producción se declaran explícitamente los orígenes del cliente real.'
)
codigo(
    'Origin: http://localhost:5173\n'
    '  -> Access-Control-Allow-Origin: http://localhost:5173\n\n'
    'Origin: https://origen-no-autorizado.example\n'
    '  -> sin cabecera Access-Control-Allow-Origin'
)
imagen('cors.png', 'Imagen 3. Cabeceras CORS para un origen permitido y uno rechazado.')
doc.add_paragraph(
    'CORS solo afecta a navegadores: no sustituye a JWT ni a los guards. '
    'Las rutas protegidas siguen exigiendo token aunque el origen esté permitido.'
)

doc.add_heading('7. Limitación de solicitudes en login', level=1)
codigo(
    "@Post('login')\n"
    "@HttpCode(HttpStatus.OK)\n"
    "@Throttle({ default: { limit: 5, ttl: 60_000 } })\n"
    "login(@Body() dto: LoginDto) { return this.authService.login(dto); }"
)
doc.add_paragraph(
    'El límite global es de 100 solicitudes por minuto y el de login es más '
    'estricto: cinco intentos por minuto. Se ejecutaron seis intentos '
    'controlados con contraseña incorrecta:'
)
codigo(
    'intento 1 -> 401 Unauthorized\n'
    'intento 2 -> 401 Unauthorized\n'
    'intento 3 -> 401 Unauthorized\n'
    'intento 4 -> 401 Unauthorized\n'
    'intento 5 -> 401 Unauthorized\n'
    'intento 6 -> 429 Too Many Requests'
)
imagen('login.png', 'Imagen 4. Seis intentos fallidos de login: cinco 401 y un 429.')
doc.add_paragraph(
    'La respuesta 429 no revela si el correo o la contraseña eran correctos.'
)

doc.add_heading('8. HTTPS/TLS y secretos', level=1)
doc.add_paragraph(
    'El README declara: «Producción: la API debe servirse detrás de HTTPS/TLS '
    '(terminación en un proxy, balanceador o plataforma de despliegue). Los '
    'secretos —JWT_SECRET y las credenciales de base de datos— viven solo en '
    'el entorno del servidor; nunca en el repositorio, el token ni los logs».'
)
doc.add_paragraph(
    'JWT_SECRET se valida al arrancar con un mínimo de 32 caracteres. '
    '.env está en .gitignore; .env.example solo documenta los nombres de '
    'las variables con valores de ejemplo.'
)

doc.add_heading('9. Pruebas automatizadas', level=1)
codigo(
    'npm run build   -> sin errores\n'
    'npm run lint    -> sin errores\n'
    'npm test        -> 1 suite, 1 prueba, 0 fallidas\n'
    'npm run test:e2e -> 4 suites, 57 pruebas, 0 fallidas'
)
imagen('tests.png', 'Imagen 5. Salida real de npm run test:e2e.')
doc.add_paragraph(
    'test/authorization.e2e-spec.ts cubre /auth/me con token válido, ausente '
    'y alterado; el rol por defecto; la matriz de cinco casos; DELETE exclusivo '
    'de admin; que el propietario no se toma del cuerpo; el sexto intento de '
    'login con 429; y que solo el origen CORS documentado recibe la cabecera.'
)

doc.add_heading('10. Conclusiones', level=1)
for conclusion in [
    'Un token válido prueba la identidad, no el permiso: borrar un curso exige además el rol admin.',
    '401 significa que no hay identidad válida; 403 que la identidad existe pero no tiene permiso.',
    'La propiedad se comprueba cerca de la regla de negocio, nunca con un ownerId enviado por el cliente.',
    'CORS reduce el abuso desde navegadores, pero no protege frente a Postman ni reemplaza a JWT.',
    'La limitación de login encarece la fuerza bruta y responde sin filtrar credenciales.',
    'HTTPS/TLS es obligatorio en producción para que el token Bearer no pueda interceptarse en tránsito.',
]:
    doc.add_paragraph(conclusion, style='List Bullet')

doc.add_paragraph()
doc.add_paragraph(f'Elaborado: {datetime.now().strftime("%d/%m/%Y")}')

ruta = '/home/joseo/Descargas/Aplicaciones_de_servicios_web-main/SEMANA_10_Autorizacion_y_Seguridad.docx'
doc.save(ruta)
print(ruta)
