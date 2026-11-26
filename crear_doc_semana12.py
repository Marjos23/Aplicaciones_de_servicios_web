from datetime import datetime
from pathlib import Path

from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.shared import Inches, Pt

BASE_DIR = Path(__file__).resolve().parent
IMAGENES = BASE_DIR / 'docs' / 'evidencia-semana-12'

doc = Document()

titulo = doc.add_heading(
    'Semana 12 · Proyecto integrador: pruebas unitarias', 0
)
titulo.alignment = WD_ALIGN_PARAGRAPH.CENTER

p = doc.add_paragraph()
p.alignment = WD_ALIGN_PARAGRAPH.CENTER
p.add_run('Curso: Aplicaciones de Servicios Web\n')
p.add_run('Sesiones 23 y 24 · CourseHub API\n')
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
    'El caso de uso UpdateCourseUseCase se prueba con un repositorio simulado inyectado por su símbolo.',
    'Se cubren éxito, recurso inexistente y reglas rechazadas: otro docente y estudiante autenticado.',
    'Las pruebas verifican que no se llame a save cuando la regla de autorización falla.',
    'La prueba del controlador comprueba la delegación de id, DTO e identidad, y la propagación del error.',
    'Las reglas de matrícula se prueban con repositorios TypeORM simulados, sin PostgreSQL.',
    'La demostración rompe temporalmente una regla, muestra el fallo y restaura el código.',
]:
    doc.add_paragraph(req, style='List Bullet')

doc.add_paragraph(
    'No se instalaron dependencias nuevas: @nestjs/testing ya estaba disponible '
    'en el proyecto. Las pruebas unitarias no abren servidor HTTP, no conectan '
    'con PostgreSQL y no consumen tokens reales. Las pruebas e2e existentes se '
    'ejecutaron al final solo como regresión.'
)

doc.add_heading('2. Ambiente de ejecución', level=1)
doc.add_paragraph('Node.js v26.1.0 y NestJS 12; Jest se invoca mediante los scripts de package.json.')
doc.add_paragraph(
    'npm test ejecuta las suites .spec.ts sin base de datos. '
    'npm run test:cov añade el reporte de cobertura. '
    'npm run test:e2e usa PostgreSQL local en localhost:5432, base coursehub-api, '
    'y conserva las 60 pruebas de las semanas anteriores.'
)
doc.add_paragraph(
    'Los ejemplos del documento y las imágenes muestran salidas reales de la '
    'terminal. No aparecen credenciales: la demostración e2e usa un valor falso '
    'dentro de un error controlado y el resumen de la imagen omite ese bloque.'
)
imagen(
    'build-lint.png',
    'Imagen 1. Compilación y lint sin errores antes de la demostración.',
)

doc.add_heading('3. Estrategia de pruebas', level=1)
tabla(
    ['Suite', 'Colaboradores simulados', 'Escenarios'],
    [
        [
            'update-course.use-case.spec.ts',
            'COURSE_REPOSITORY',
            'Propietario, administrador, inexistente, otro docente, estudiante y createdByUserId del cuerpo.',
        ],
        [
            'courses.controller.spec.ts',
            'CoursesService, EnrollmentsService, UpdateCourseUseCase y guards',
            'Delegación del PATCH, propagación de ForbiddenException e id transformado en la consulta de matrículas.',
        ],
        [
            'enrollments.service.spec.ts',
            'Repository<Enrollment>, Repository<Student> y Repository<Course>',
            'Matrícula válida, estudiante o curso inexistente, inactivo, duplicado y error 23505.',
        ],
        [
            'Suites e2e existentes',
            'Ninguno: aplicación completa y PostgreSQL real',
            'Regresión del contrato HTTP y de las restricciones de la base de datos.',
        ],
    ],
)
doc.add_paragraph(
    'La regla de negocio se prueba donde vive. El controlador se prueba por '
    'separado para verificar traducción de parámetros y delegación, no para '
    'repetir la regla. Los servicios con infraestructura se prueban con los '
    'repositorios reemplazados por objetos jest.fn().'
)

doc.add_heading('4. Caso de uso con repositorio simulado', level=1)
doc.add_paragraph(
    'El módulo de prueba registra el caso de uso y entrega un objeto falso para '
    'COURSE_REPOSITORY. Eso permite inyectar escenarios con findById y comprobar '
    'después si save fue llamado.'
)
codigo(
    "courses = {\n"
    "  findById: jest.fn().mockResolvedValue(course),\n"
    "  save: jest.fn().mockImplementation(async (value: Course) => value),\n"
    "};\n\n"
    "const module: TestingModule = await Test.createTestingModule({\n"
    "  providers: [\n"
    "    UpdateCourseUseCase,\n"
    "    { provide: COURSE_REPOSITORY, useValue: courses },\n"
    "  ],\n"
    "}).compile();\n\n"
    "useCase = module.get(UpdateCourseUseCase);"
)
codigo(
    "it('niega el curso a otro docente y no guarda cambios', async () => {\n"
    "  await expect(\n"
    "    useCase.execute(1, { title: 'Ajeno' }, actor(100, UserRole.TEACHER)),\n"
    "  ).rejects.toBeInstanceOf(ForbiddenException);\n"
    "  expect(courses.save).not.toHaveBeenCalled();\n"
    "});"
)
doc.add_paragraph(
    'El repositorio falso devuelve el curso de ownerId 7. El actor tiene id 100 '
    'y rol teacher, por lo que no es propietario. La expectativa exige un '
    'ForbiddenException y la segunda exige que no haya escritura. Las demás '
    'pruebas cubren al administrador, al propietario, al estudiante, al id '
    'inexistente y el hecho de que createdByUserId enviado en el DTO no cambia '
    'la propiedad.'
)
imagen(
    'unitarias.png',
    'Imagen 2. Cuatro suites y 16 pruebas unitarias superadas sin base de datos.',
)

doc.add_heading('5. Prueba del controlador', level=1)
doc.add_paragraph(
    'CoursesController tiene tres colaboradores. En la prueba se reemplazan por '
    'objetos con jest.fn(). También se sobreescriben JwtAuthGuard y RolesGuard: '
    'los decoradores @UseGuards hacen que Nest intente resolver sus dependencias '
    'al compilar el módulo de prueba, aunque las llamadas se hagan directamente '
    'al método.'
)
codigo(
    "const module: TestingModule = await Test.createTestingModule({\n"
    "  controllers: [CoursesController],\n"
    "  providers: [\n"
    "    { provide: CoursesService, useValue: coursesService },\n"
    "    { provide: EnrollmentsService, useValue: enrollmentsService },\n"
    "    { provide: UpdateCourseUseCase, useValue: updateCourse },\n"
    "  ],\n"
    "})\n"
    "  .overrideGuard(JwtAuthGuard)\n"
    "  .useValue({ canActivate: () => true })\n"
    "  .overrideGuard(RolesGuard)\n"
    "  .useValue({ canActivate: () => true })\n"
    "  .compile();"
)
codigo(
    "updateCourse.execute.mockResolvedValue(updated);\n"
    "await expect(controller.update(7, dto, actor)).resolves.toEqual(updated);\n"
    "expect(updateCourse.execute).toHaveBeenCalledWith(7, dto, actor);\n\n"
    "const error = new ForbiddenException('You cannot modify this course');\n"
    "updateCourse.execute.mockRejectedValue(error);\n"
    "await expect(controller.update(7, dto, actor)).rejects.toBe(error);"
)
doc.add_paragraph(
    'La primera parte comprueba que el controlador no reordena ni reemplaza los '
    'argumentos. La segunda comprueba que un error de la regla no se convierte '
    'en éxito ni se disfraza de otro tipo. La tercera verifica que el id '
    'transformado por ParseIntPipe llegue como número a findByCourse.'
)

doc.add_heading('6. Reglas de negocio con repositorios simulados', level=1)
doc.add_paragraph(
    'EnrollmentsService depende de tres repositorios de TypeORM. getRepositoryToken '
    'permite sustituirlos sin levantar TypeORM ni PostgreSQL. El orden de las '
    'comprobaciones importa: primero el estudiante, luego el curso y después la '
    'pareja repetida.'
)
tabla(
    ['Escenario', 'Resultado esperado', 'Comprobación adicional'],
    [
        ['Estudiante válido, curso válido, sin duplicado', 'Matrícula guardada', 'save se llama una vez.'],
        ['Estudiante inexistente', 'NotFoundException', 'El curso no se consulta.'],
        ['Estudiante inactivo', 'BadRequestException', 'El curso no se consulta.'],
        ['Curso inexistente', 'NotFoundException', 'No se busca duplicado.'],
        ['Pareja repetida', 'ConflictException', 'No se guarda.'],
        ['QueryFailedError con código 23505', 'ConflictException', 'La carrera de dos peticiones responde igual que el duplicado previsto.'],
    ],
)
codigo(
    "enrollments.save.mockRejectedValueOnce(\n"
    "  new QueryFailedError('INSERT', [], { code: '23505' }),\n"
    ");\n\n"
    "await expect(\n"
    "  service.create({ studentId: 3, courseId: 5 }),\n"
    ").rejects.toBeInstanceOf(ConflictException);"
)

doc.add_heading('7. Demostración: la expectativa detecta el cambio', level=1)
doc.add_paragraph(
    'Para demostrar que la prueba no es decorativa se cambió temporalmente la '
    'condición de autorización por una siempre falsa. El archivo se restauró '
    'inmediatamente con git checkout después de ejecutar la prueba.'
)
tabla(
    ['Estado', 'Condición', 'Resultado'],
    [
        ['Correcto', 'if (!isAdmin && !isOwner)', '16 pruebas pasan.'],
        ['Cambio temporal', 'if (!isAdmin && !isOwner && false)', '2 pruebas de autorización fallan; 14 se omiten por el filtro -t.'],
        ['Restaurado', 'if (!isAdmin && !isOwner)', '16 pruebas vuelven a pasar.'],
    ],
)
codigo(
    "npm test -- --runInBand -t 'niega el curso'"
)
doc.add_paragraph(
    'La salida muestra “Received promise resolved instead of rejected”: la '
    'promesa se resolvió con un curso modificado cuando debía rechazarse. Eso '
    'demuestra que la aserción protege la regla y no solo el mensaje de error.'
)
imagen(
    'fallo-esperado.png',
    'Imagen 3. Fallo esperado al desactivar temporalmente la regla de propiedad.',
)

doc.add_heading('8. Cobertura y verificación', level=1)
codigo(
    'npm run build    -> sin errores\n'
    'npm run lint     -> sin errores\n'
    'npm test         -> 4 suites, 16 pruebas, 0 fallidas\n'
    'npm run test:cov -> reporte generado\n'
    'npm run test:e2e -> 5 suites, 60 pruebas, 0 fallidas'
)
tabla(
    ['Archivo', 'Stmts', 'Branch', 'Funcs', 'Lines'],
    [
        ['src/courses/use-cases/update-course.use-case.ts', '100', '100', '100', '100'],
        ['src/courses/ports/course-repository.ts', '100', '100', '100', '100'],
        ['src/courses/courses.controller.ts', '87.09', '75', '42.85', '86.2'],
        ['src/enrollments/enrollments.service.ts', '50', '46.34', '42.85', '48.27'],
        ['All files', '26.31', '23.98', '12.5', '25.3'],
    ],
)
doc.add_paragraph(
    'El objetivo de la semana era probar reglas concretas, no inflar un porcentaje '
    'global. El caso de uso y su puerto quedan al 100%; el controlador cubre las '
    'tres rutas simuladas; el servicio de matrículas cubre create. El porcentaje '
    'global es bajo porque módulos enteros (auth, students, middleware, filter e '
    'interceptor) se comprueban en e2e y no se incluyeron en estas suites '
    'unitarias. El reporte se muestra tal cual, sin ocultar esa brecha.'
)
imagen(
    'cobertura.png',
    'Imagen 4. Cobertura de los archivos trabajados y resumen de ejecución.',
)

doc.add_heading('9. Regresión de extremo a extremo', level=1)
doc.add_paragraph(
    'Las 60 pruebas e2e de las semanas anteriores siguen pasando con el nuevo '
    'código de prueba. Esto confirma que añadir suites unitarias y adaptar la '
    'prueba del caso de uso no cambió el contrato HTTP ni las reglas ya '
    'demostradas con PostgreSQL real.'
)
imagen(
    'e2e.png',
    'Imagen 5. Regresión e2e: cinco suites y 60 pruebas superadas.',
)

doc.add_heading('10. Conclusiones', level=1)
for conclusion in [
    ' Un repo simulado permite probar la decisión del caso de uso sin base de datos.',
    ' La prueba del controlador separa su responsabilidad: delegar y propagar, no decidir la regla.',
    ' Los mocks de TypeORM hacen explícitas las reglas de estudiante, curso y duplicado.',
    ' La demostración del fallo temporal prueba que las aserciones detectan cambios reales.',
    ' La cobertura focalizada es alta donde se trabajó; el reporte global identifica con honestidad el trabajo pendiente.',
    ' La regresión e2e demuestra que las pruebas nuevas no rompieron el comportamiento previo.',
]:
    doc.add_paragraph(conclusion.strip(), style='List Bullet')

doc.add_paragraph()
doc.add_paragraph(f'Elaborado: {datetime.now().strftime("%d/%m/%Y")}')

ruta = BASE_DIR / 'SEMANA_12_Proyecto_integrador_pruebas_unitarias.docx'
doc.save(ruta)
print(ruta)
