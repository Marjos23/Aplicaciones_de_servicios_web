from datetime import datetime
from pathlib import Path

from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.shared import Inches, Pt

BASE_DIR = Path(__file__).resolve().parent
IMAGENES = BASE_DIR / 'docs' / 'evidencia-semana-11'

doc = Document()

titulo = doc.add_heading(
    'Semana 11 · Arquitectura y componentes transversales', 0
)
titulo.alignment = WD_ALIGN_PARAGRAPH.CENTER

p = doc.add_paragraph()
p.alignment = WD_ALIGN_PARAGRAPH.CENTER
p.add_run('Curso: Aplicaciones de Servicios Web\n')
p.add_run('Sesiones 21 y 22 · CourseHub API\n')
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
    doc.add_picture(str(IMAGENES / nombre), width=Inches(6.2))
    pie_parrafo = doc.add_paragraph()
    pie_parrafo.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = pie_parrafo.add_run(pie)
    run.italic = True
    run.font.size = Pt(9)


doc.add_heading('1. Alcance verificado', level=1)
for req in [
    'Existe un middleware de registro que no guarda secretos ni cuerpos sensibles.',
    'La API devuelve errores con una forma consistente y no expone trazas internas.',
    'Un módulo de negocio incorpora un caso de uso separado de su controlador.',
    'Ese caso usa un contrato de repositorio pequeño y un adaptador TypeORM.',
    'La autorización de propiedad permanece junto a la regla de negocio.',
]:
    doc.add_paragraph(req, style='List Bullet')

doc.add_paragraph(
    'La refactorización es gradual: se transformó PATCH /courses/:id y se '
    'mantuvieron los demás módulos. No se reescribió la aplicación ni se '
    'introdujo una arquitectura compleja sin un problema que resolver.'
)

doc.add_heading('2. Ambiente de ejecución', level=1)
doc.add_paragraph('Node.js v26.1.0 y NestJS 12, modo development (NODE_ENV=development).')
doc.add_paragraph(
    'PostgreSQL local en localhost:5432, base coursehub-api. Las suites e2e '
    'usaron prefijos propios (http_, demo_, query_, authz_, arch_) y eliminaron '
    'sus tablas al terminar, sin mezclarse con los datos de desarrollo.'
)
doc.add_paragraph(
    'Las cuentas de la demostración se crearon solo en la base local. Los '
    'tokens se mantuvieron en variables de entorno de la terminal y no se '
    'muestran en las imágenes: en el comando aparece $STUDENT, nunca su valor.'
)

doc.add_heading('3. Componentes transversales', level=1)
tabla(
    ['Componente', 'Momento', 'Responsabilidad'],
    [
        [
            'RequestLoggerMiddleware',
            'Antes del controlador',
            'X-Request-Id y registro de método, ruta, estado y duración. Sin headers ni bodies.',
        ],
        ['JwtAuthGuard / RolesGuard', 'Antes del controlador', 'Deciden si la petición continúa.'],
        ['ValidationPipe / ParseIntPipe', 'Antes del método', 'Validan el cuerpo y convierten el id.'],
        [
            'TimingInterceptor',
            'Antes y después del método',
            'Mide duración, añade X-Response-Time y la registra sin tocar la regla.',
        ],
        [
            'AllExceptionsFilter',
            'Ante una excepción',
            'Traduce cualquier error a una respuesta HTTP uniforme.',
        ],
    ],
)

doc.add_paragraph(
    'Los cinco componentes se registran una sola vez en AppModule: el '
    'middleware en configure(consumer) y el filter y el interceptor mediante '
    'APP_FILTER y APP_INTERCEPTOR. No hay try/catch ni logging repetido en los '
    'controladores.'
)
codigo(
    "configure(consumer: MiddlewareConsumer): void {\n"
    "  consumer\n"
    "    .apply(RequestLoggerMiddleware)\n"
    "    .forRoutes({ path: '*', method: RequestMethod.ALL });\n"
    "}\n\n"
    "providers: [\n"
    "  { provide: APP_GUARD, useClass: ThrottlerGuard },\n"
    "  { provide: APP_FILTER, useClass: AllExceptionsFilter },\n"
    "  { provide: APP_INTERCEPTOR, useClass: TimingInterceptor },\n"
    "]"
)

doc.add_heading('3.1 Registro seguro', level=2)
codigo(
    "use(req: RequestWithId, res: Response, next: NextFunction): void {\n"
    "  const startedAt = Date.now();\n"
    "  const requestId = randomUUID();\n"
    "  req.requestId = requestId;\n"
    "  res.setHeader('X-Request-Id', requestId);\n"
    "  res.on('finish', () => {\n"
    "    this.logger.log({\n"
    "      event: 'request', requestId, method: req.method,\n"
    "      path: req.path, status: res.statusCode,\n"
    "      durationMs: Date.now() - startedAt,\n"
    "    });\n"
    "  });\n"
    "  next();\n"
    "}"
)
doc.add_paragraph(
    'El objeto registrado contiene solo claves operativas. No se registran '
    'Authorization, tokens, contraseñas ni el cuerpo de la petición. La ruta '
    'se toma de req.path, sin la query, para evitar parámetros sensibles.'
)
imagen(
    'logs.png',
    'Imagen 1. Registros reales: RequestLoggerMiddleware, TimingInterceptor y AllExceptionsFilter.',
)

doc.add_heading('3.2 Medición del tiempo', level=2)
codigo(
    "const startedAt = Date.now();\n"
    "const record = () => {\n"
    "  const durationMs = Date.now() - startedAt;\n"
    "  response.setHeader('X-Response-Time', `${durationMs}ms`);\n"
    "  this.logger.log({ event: 'response_time', method: request.method,\n"
    "    path: request.path, durationMs });\n"
    "};\n"
    "return next.handle().pipe(tap({ next: record, error: record }));"
)
doc.add_paragraph(
    'El interceptor solo mide: no transforma la respuesta, no oculta errores '
    'y no sustituye a una regla de negocio. Las peticiones rechazadas por un '
    'guard no llegan al interceptor, por eso en la imagen 2 el caso 403 no '
    'muestra X-Response-Time; sí muestra X-Request-Id, que nace en el middleware.'
)

doc.add_heading('4. Forma uniforme de error', level=1)
codigo(
    "@Catch()\n"
    "export class AllExceptionsFilter implements ExceptionFilter {\n"
    "  catch(exception: unknown, host: ArgumentsHost): void {\n"
    "    const status = exception instanceof HttpException\n"
    "      ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;\n"
    "    const body = { statusCode: status, message, path: request.path,\n"
    "      timestamp: new Date().toISOString(), requestId: request.requestId };\n"
    "    if (status >= 500) this.logger.error({ ...body, error, stack });\n"
    "    else this.logger.warn(body);\n"
    "    response.status(status).json(body);\n"
    "  }\n"
    "}"
)
codigo(
    '{\n'
    '  "statusCode": 404,\n'
    '  "message": "Course with id 999999 not found",\n'
    '  "path": "/courses/999999",\n'
    '  "timestamp": "2026-11-24T02:00:00.000Z",\n'
    '  "requestId": "7b0e1c22-7e0a-4b2a-8e5c-2f9d6a1b4c3f"\n'
    '}'
)
doc.add_paragraph(
    'Un error inesperado responde 500 con message "Internal server error". '
    'La traza, la consulta SQL y las variables de entorno quedan únicamente en '
    'los registros internos controlados.'
)

doc.add_heading('4.1 Demostración de los cuatro casos', level=2)
tabla(
    ['Petición', 'Resultado', 'Qué demuestra'],
    [
        ['GET /courses', '200 OK', 'Solicitud correcta: items y meta, X-Request-Id y X-Response-Time.'],
        ['GET /courses/abc', '400 Bad Request', 'ParseIntPipe rechaza el identificador antes del servicio.'],
        ['GET /courses/999999', '404 Not Found', 'Recurso inexistente con la misma forma de error.'],
        ['PATCH /courses/:id con token de estudiante', '403 Forbidden', 'Identidad válida sin permiso: la regla de propiedad se aplica en el caso de uso.'],
    ],
)
codigo(
    'curl -i http://localhost:3000/courses\n'
    'curl -i http://localhost:3000/courses/abc\n'
    'curl -i http://localhost:3000/courses/999999\n'
    'curl -i -X PATCH http://localhost:3000/courses/1 \\\n'
    '  -H \'Content-Type: application/json\' \\\n'
    '  -H "Authorization: Bearer $STUDENT" -d \'{"title":"Sin permiso"}\''
)
imagen(
    'demo.png',
    'Imagen 2. Cuatro peticiones reales con curl -i: 200, 400, 404 y 403.',
)
doc.add_paragraph(
    'En el código: HTTP en src/courses/courses.controller.ts, la regla en '
    'src/courses/use-cases/update-course.use-case.ts y la persistencia en '
    'src/courses/adapters/typeorm-course.repository.ts.'
)

doc.add_heading('5. Caso de uso, puerto y adaptador', level=1)
codigo(
    'CoursesController (HTTP)\n'
    '  → UpdateCourseUseCase (regla de negocio y propiedad)\n'
    '  → CourseRepository (puerto: findById y save)\n'
    '  → TypeOrmCourseRepository (adaptador)\n'
    '  → PostgreSQL'
)
doc.add_paragraph(
    'El controlador conoce rutas, parámetros y DTOs. El caso de uso no importa '
    'HTTP ni TypeORM: recibe un actor, un id y los cambios, y decide si la '
    'operación es permitida. El puerto es pequeño porque la regla solo necesita '
    'encontrar y guardar; no es una interfaz enorme creada por costumbre.'
)
codigo(
    "export const COURSE_REPOSITORY = Symbol('COURSE_REPOSITORY');\n\n"
    'export interface CourseRepository {\n'
    '  findById(id: number): Promise<Course | null>;\n'
    '  save(course: Course): Promise<Course>;\n'
    '}'
)
codigo(
    'const course = await this.courses.findById(id);\n'
    "if (!course) throw new NotFoundException(`Course with id ${id} not found`);\n\n"
    'const isAdmin = actor.role === UserRole.ADMIN;\n'
    'const isOwner =\n'
    "  actor.role === UserRole.TEACHER && course.createdByUserId === actor.id;\n"
    'if (!isAdmin && !isOwner) {\n'
    "  throw new ForbiddenException('You cannot modify this course');\n"
    '}\n\n'
    "if (changes.title !== undefined) course.title = changes.title;\n"
    "if (changes.level !== undefined) course.level = changes.level;\n"
    'return this.courses.save(course);'
)
doc.add_paragraph(
    'El propietario se lee del curso guardado, nunca del cuerpo: solo se '
    'asignan title y level. Así, un createdByUserId enviado por el cliente no '
    'puede cambiar la propiedad aunque el DTO se relaje en el futuro. La '
    'autorización de propiedad vive junto a la regla, no en el controlador.'
)
codigo(
    '@Injectable()\n'
    'export class TypeOrmCourseRepository implements CourseRepository {\n'
    '  constructor(\n'
    '    @InjectRepository(Course)\n'
    '    private readonly repository: Repository<Course>,\n'
    '  ) {}\n\n'
    '  findById(id: number) { return this.repository.findOneBy({ id }); }\n'
    '  save(course: Course) { return this.repository.save(course); }\n'
    '}'
)
codigo(
    'providers: [\n'
    '  CoursesService,\n'
    '  UpdateCourseUseCase,\n'
    '  { provide: COURSE_REPOSITORY, useClass: TypeOrmCourseRepository },\n'
    ']'
)
doc.add_paragraph(
    'Si cambia la regla «solo el propietario edita», se modifica el caso de '
    'uso. Si cambia el almacenamiento, se modifica el adaptador. Si cambia la '
    'ruta HTTP, se modifica el controlador. Son tres razones distintas de cambio.'
)

doc.add_heading('6. SOLID aplicado al caso', level=1)
tabla(
    ['Principio', 'Decisión en el proyecto'],
    [
        ['Responsabilidad única', 'El caso de uso decide la regla; el adaptador solo traduce a TypeORM.'],
        ['Abierto/cerrado', 'Una nueva implementación de CourseRepository no obliga a tocar la regla.'],
        ['Sustitución', 'El caso de uso acepta cualquier CourseRepository que cumpla el contrato.'],
        ['Segregación', 'El puerto pide solo findById y save.'],
        ['Inversión', 'La regla depende de un símbolo y una interfaz, no de Repository<Course>.'],
    ],
)

doc.add_heading('7. Pruebas automatizadas', level=1)
codigo(
    'npm run build    -> sin errores\n'
    'npm run lint     -> sin errores\n'
    'npm test         -> 2 suites, 7 pruebas, 0 fallidas\n'
    'npm run test:e2e -> 5 suites, 60 pruebas, 0 fallidas'
)
doc.add_paragraph(
    'test/update-course.use-case.spec.ts comprueba la regla con un '
    'repositorio falso: docente propietario y administrador pueden editar; '
    'otro docente y un estudiante reciben ForbiddenException; un id ausente '
    'recibe NotFoundException; y un createdByUserId enviado en los cambios no '
    'modifica el propietario.'
)
doc.add_paragraph(
    'test/observability.e2e-spec.ts comprueba los cuatro casos de la '
    'demostración, la forma común de error con statusCode/message/path/'
    'timestamp/requestId, una respuesta 500 sin traza ni SQL y que los registros '
    'no contienen credenciales ni cuerpos.'
)
imagen(
    'build-lint.png',
    'Imagen 3. Compilación y lint sin errores.',
)
imagen(
    'unitarias.png',
    'Imagen 4. Pruebas unitarias del caso de uso y de la app.',
)
imagen(
    'e2e.png',
    'Imagen 5. Cinco suites y 60 pruebas de extremo a extremo superadas.',
)

doc.add_heading('8. Conclusiones', level=1)
for conclusion in [
    ' Los componentes transversales se aplican una sola vez y en su etapa correcta: middleware para registrar, guard para decidir, pipe para validar, interceptor para medir y filter para traducir errores.',
    ' La respuesta de error es predecible y segura: la información sensible se queda en los registros internos.',
    ' La regla de propiedad se puede leer y probar sin conocer rutas ni TypeORM.',
    ' El puerto pequeño evita acoplar la regla a los detalles de persistencia.',
    ' La refactorización conservó el contrato HTTP: las pruebas anteriores siguen pasando.',
]:
    doc.add_paragraph(conclusion.strip(), style='List Bullet')

doc.add_paragraph()
doc.add_paragraph(f'Elaborado: {datetime.now().strftime("%d/%m/%Y")}')

ruta = BASE_DIR / 'SEMANA_11_Arquitectura_y_componentes_transversales.docx'
doc.save(ruta)
print(ruta)
