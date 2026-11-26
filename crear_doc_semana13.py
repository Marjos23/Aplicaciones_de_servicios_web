from datetime import datetime
from pathlib import Path

from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.shared import Inches, Pt

BASE_DIR = Path(__file__).resolve().parent
IMAGENES = BASE_DIR / 'docs' / 'evidencia-semana-13'

doc = Document()

titulo = doc.add_heading(
    'Semana 13 · Pruebas de integración y automatización', 0
)
titulo.alignment = WD_ALIGN_PARAGRAPH.CENTER

p = doc.add_paragraph()
p.alignment = WD_ALIGN_PARAGRAPH.CENTER
p.add_run('Curso: Aplicaciones de Servicios Web\n')
p.add_run('Sesiones 25 y 26 · CourseHub API\n')
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
    'Hay una suite e2e con tres casos: GET /courses como ruta pública, POST /courses con token de administrador como ruta protegida y POST /courses sin token o con rol student como rechazo.',
    'La configuración y los datos son exclusivos de prueba: .env.test apunta a coursehub-api-test y cada suite usa un prefijo de tablas propio.',
    'La preparación reinicia las tablas de la suite antes de empezar y la limpieza las elimina al terminar, sin depender de datos manuales.',
    'El repositorio contiene .github/workflows/quality.yml: instala desde package-lock.json, verifica tipos, analiza, ejecuta pruebas y construye el proyecto.',
    'El README explica cómo preparar la base, ejecutar las verificaciones y provocar un fallo controlado.',
]:
    doc.add_paragraph(req, style='List Bullet')

doc.add_paragraph(
    'No se instalaron dependencias nuevas. Se reutilizaron Jest 30, Supertest 7, '
    '@nestjs/testing, tsc y oxlint, ya presentes en el proyecto.'
)

doc.add_heading('2. Ambiente de ejecución', level=1)
doc.add_paragraph(
    'La verificación local se hizo con Node.js 26, NestJS 12, Jest 30 y '
    'PostgreSQL 17 en el contenedor coursehub_test_db. El flujo de CI fija '
    'Node.js 22 y usa un servicio PostgreSQL 17 efímero. Antes de ejecutar '
    'las pruebas de integración se prepara la base exclusiva:'
)
codigo(
    'cp .env.test.example .env.test\n'
    'docker compose -f docker-compose.test.yml up -d --wait\n'
    'docker compose -f docker-compose.test.yml down -v'
)
doc.add_paragraph(
    'El contenedor publica el puerto 5435 y guarda sus datos en tmpfs, así que '
    'al detenerlo no queda información de prueba en el disco.'
)
imagen(
    'base-de-prueba.png',
    'Imagen 1. Contenedor PostgreSQL exclusivo de prueba en estado Healthy.',
)

doc.add_heading('3. Configuración y datos exclusivos de prueba', level=1)
doc.add_paragraph(
    'test/load-env.ts carga .env.test antes que .env.local y .env. Como dotenv '
    'no sobrescribe variables ya definidas, las variables inyectadas por GitHub '
    'Actions tienen prioridad en CI. Si NODE_ENV no es test, la suite se detiene '
    'antes de abrir una conexión: así no es posible apuntar las pruebas a la '
    'base de desarrollo por accidente.'
)
codigo(
    "config({ path: ['.env.test', '.env.local', '.env'] });\n\n"
    "if (process.env.NODE_ENV !== 'test') {\n"
    "  throw new Error(\n"
    "    'Las pruebas e2e requieren NODE_ENV=test. Copia .env.test.example a .env.test o define las variables de prueba en el entorno.',\n"
    "  );\n"
    "}"
)
doc.add_paragraph(
    'test/test-data-source.ts crea la conexión con DATABASE_NAME del ambiente '
    'de prueba y aplica entityPrefix por suite. El prefijo semana13_ pertenece '
    'a la suite nueva; los de las semanas anteriores siguen siendo demo_, '
    'http_, query_, authz_ y arch_. Ninguna suite usa dropSchema: solo elimina '
    'sus propias tablas prefijadas.'
)
imagen(
    'configuracion.png',
    'Imagen 2. Variables de prueba y guardián de NODE_ENV en test/load-env.ts.',
)

doc.add_heading('4. Casos e2e: pública, protegida y rechazo', level=1)
tabla(
    ['Situación', 'Solicitud', 'Respuesta esperada', 'Comprobación adicional'],
    [
        [
            'Ruta pública',
            'GET /courses',
            '200',
            'El cuerpo items contiene el curso sembrado solo para esta suite.',
        ],
        [
            'Ruta protegida',
            'POST /courses con Bearer admin',
            '201',
            'createdByUserId es positivo y la fila existe en la tabla semana13_course.',
        ],
        [
            'Rechazo',
            'POST /courses sin token y con token student',
            '401 y 403',
            'Ninguna de las dos solicitudes crea un curso.',
        ],
    ],
)
codigo(
    "const response = await http().get('/courses').expect(200);\n"
    "expect(response.body.items).toEqual(\n"
    '  expect.arrayContaining([\n'
    '    expect.objectContaining({ title: publicTitle, level: \'beginner\' }),\n'
    '  ]),\n'
    ');'
)
codigo(
    "await http()\n"
    "  .post('/courses')\n"
    '  .send({ title: \'Sin token\', level: \'beginner\' })\n'
    '  .expect(401);\n\n'
    "await http()\n"
    "  .post('/courses')\n"
    '  .set(bearer(studentToken))\n'
    '  .send({ title: \'Sin permiso\', level: \'beginner\' })\n'
    '  .expect(403);'
)
doc.add_paragraph(
    'La prueba protegida obtiene un token real mediante POST /auth/login: no '
    'se sustituye JwtAuthGuard ni RolesGuard. Por eso el caso verifica la '
    'colaboración entre controlador, guards, DTOs, caso de uso y persistencia.'
)
imagen(
    'e2e-repetible.png',
    'Imagen 3. La suite de la Semana 13 se ejecuta dos veces con el mismo resultado: 3 pruebas superadas.',
)

doc.add_heading('5. Preparación y limpieza repetible', level=1)
doc.add_paragraph(
    'test/e2e-fixture.ts concentra el arranque y el cierre. Pide una conexión '
    'con reset: true, que borra y vuelve a sincronizar solo las tablas del '
    'prefijo; después compila AppModule, sustituye el DataSource por el de '
    'prueba y aplica el mismo ValidationPipe que usa main.ts.'
)
codigo(
    'export async function createE2eFixture(prefix: string) {\n'
    '  const dataSource = await createTestDataSource({ prefix, reset: true });\n'
    '  const moduleFixture = await Test.createTestingModule({\n'
    '    imports: [AppModule],\n'
    '  })\n'
    '    .overrideProvider(getDataSourceToken())\n'
    '    .useValue(dataSource)\n'
    '    .compile();\n\n'
    '  const app = moduleFixture.createNestApplication();\n'
    '  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true,\n'
    '    forbidNonWhitelisted: true }));\n'
    '  await app.init();\n'
    '}'
)
codigo(
    'export async function closeE2eFixture(fixture: E2eFixture) {\n'
    '  await dropTestTables(fixture.dataSource, fixture.prefix);\n'
    '  await fixture.app.close();\n'
    '  await closeTestDataSource(fixture.dataSource);\n'
    '}'
)
doc.add_paragraph(
    'El orden del cierre importa: primero se borran las filas y las tablas '
    'mientras la conexión sigue abierta, luego se cierra la aplicación y '
    'por último el DataSource. El reinicio simulado de la semana 5 conserva '
    'su comportamiento porque reset es opt-in y esa suite no lo solicita.'
)

doc.add_heading('6. Demostración: la expectativa detecta el cambio', level=1)
doc.add_paragraph(
    'Para comprobar que la aserción de rechazo no es decorativa se cambió '
    'temporalmente .expect(403) por .expect(200) en la última prueba, se ejecutó '
    'la suite filtrada y se restauró el archivo inmediatamente.'
)
tabla(
    ['Estado', 'Expectativa', 'Resultado'],
    [
        ['Correcto', '.expect(403)', '3 pruebas superadas.'],
        ['Cambio temporal', '.expect(200)', '1 prueba fallida: expected 200, got 403.'],
        ['Restaurado', '.expect(403)', '3 pruebas vuelven a pasar.'],
    ],
)
codigo("npm run test:e2e -- --runInBand -t 'Semana 13'")
doc.add_paragraph(
    'Jest señala la línea 82 y supertest informa “expected 200 OK, got 403 '
    'Forbidden”. Eso confirma que la prueba observa la respuesta HTTP real y '
    'que la autorización sigue actuando: el servidor sí devolvió 403; la '
    'expectativa modificada era la incorrecta.'
)
imagen(
    'fallo-esperado.png',
    'Imagen 4. Fallo esperado al cambiar la expectativa de rechazo; la salida omite el bloque informativo de dotenv.',
)

doc.add_heading('7. Automatización con GitHub Actions', level=1)
doc.add_paragraph(
    '.github/workflows/quality.yml se activa en push y pull_request. Tiene un '
    'solo job verify con un servicio PostgreSQL y pasos con nombre propio, de '
    'modo que el informe de GitHub señala qué control falló sin leer toda la '
    'salida.'
)
tabla(
    ['Paso', 'Acción', 'Señal que aporta'],
    [
        ['checkout / setup-node', 'Node.js 22 y caché npm', 'Entorno reproducible.'],
        ['npm ci', 'Instalación desde package-lock.json', 'Mismas versiones que en local.'],
        ['Verificar tipos', 'npm run typecheck', 'Errores de TypeScript antes de ejecutar.'],
        ['Analizar código', 'npm run lint', 'oxlint sobre src/ y test/.'],
        ['Pruebas unitarias', 'npm test -- --runInBand', '16 reglas rápidas sin base de datos.'],
        ['Pruebas e2e', 'npm run test:e2e -- --runInBand', '63 pruebas HTTP contra PostgreSQL de prueba.'],
        ['Compilar', 'npm run build', 'La aplicación efectivamente genera dist/.'],
    ],
)
doc.add_paragraph(
    'La revisión de dependencias en solicitudes de cambio se documenta como '
    'pendiente de activar en la configuración de seguridad del repositorio; '
    'no se presenta como un control que ya esté ejecutándose.'
)
imagen(
    'workflow.png',
    'Imagen 5. Flujo completo de calidad: instalación, análisis, pruebas y compilación.',
)

doc.add_heading('8. Verificación local y regresión', level=1)
codigo(
    'npm run typecheck -> sin errores\n'
    'npm run lint      -> sin errores\n'
    'npm run build     -> sin errores\n'
    'npm test          -> 4 suites, 16 pruebas, 0 fallidas\n'
    'npm run test:e2e  -> 6 suites, 63 pruebas, 0 fallidas\n'
    'npm run test:e2e  -> segunda ejecución idéntica'
)
doc.add_paragraph(
    'Las imágenes proceden de salidas reales de terminal. En el resumen de la '
    'regresión e2e se omitió el bloque de error forzado de la suite de '
    'observabilidad, que contiene un valor falso de prueba usado para verificar '
    'que los errores 500 no filtran secretos; el resultado de las 63 pruebas se '
    'muestra íntegro.'
)
imagen(
    'verificacion.png',
    'Imagen 6. Typecheck, lint y build terminan sin errores.',
)
imagen(
    'unitarias.png',
    'Imagen 7. Las 16 pruebas unitarias de las cuatro suites siguen pasando.',
)
imagen(
    'regresion-e2e.png',
    'Imagen 8. Regresión e2e completa: seis suites y 63 pruebas superadas.',
)

doc.add_heading('9. Conclusiones', level=1)
for conclusion in [
    'La ruta pública, la protegida y el rechazo se comprueban por HTTP con la aplicación completa, no con repositorios simulados.',
    'La base de prueba es independiente de la de desarrollo y las tablas se reinician y se eliminan alrededor de cada suite.',
    'La suite nueva pasó dos veces seguidas sin intervención manual y sin depender del orden de ejecución.',
    'El fallo controlado demuestra que una expectativa incorrecta se reporta con claridad y que el servidor mantiene el rechazo 403.',
    'El flujo de GitHub Actions convierte esas comprobaciones en una señal automática antes de integrar cambios.',
    'La regresión confirma que las 60 pruebas e2e anteriores y las 16 unitarias siguen pasando.',
]:
    doc.add_paragraph(conclusion, style='List Bullet')

doc.add_paragraph()
doc.add_paragraph(f'Elaborado: {datetime.now().strftime("%d/%m/%Y")}')

ruta = BASE_DIR / 'SEMANA_13_Pruebas_de_integracion_y_automatizacion.docx'
doc.save(ruta)
print(ruta)
