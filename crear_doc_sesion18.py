from docx import Document
from docx.shared import Pt
from docx.enum.text import WD_ALIGN_PARAGRAPH
from datetime import datetime

doc = Document()

# Portada
titulo = doc.add_heading('Sesión 18 · Verificar JWT y proteger rutas', 0)
titulo.alignment = WD_ALIGN_PARAGRAPH.CENTER

p = doc.add_paragraph()
p.alignment = WD_ALIGN_PARAGRAPH.CENTER
p.add_run('Curso: Aplicaciones de Servicios Web\n')
p.add_run('Tema: Protección de rutas con JWT\n')
p.add_run(f'Fecha: {datetime.now().strftime("%d/%m/%Y")}')

doc.add_page_break()

# 1
doc.add_heading('1. Objetivo', level=1)
doc.add_paragraph('Verificar Bearer tokens con una estrategia JWT, bloquear rutas sin identidad válida, acceder al usuario autenticado a través de req.user y proteger al menos una ruta de negocio sin romper la validación con DTOs.')

# 2
doc.add_heading('2. Ambiente de ejecución', level=1)
doc.add_paragraph('La aplicación fue iniciada en modo development (NODE_ENV=development).')
doc.add_paragraph('Fuera de development, TypeORM deja de sincronizar el esquema.')
doc.add_paragraph('PostgreSQL levantado con docker-compose en puerto 5434 (coursehub_db).')

# 3
doc.add_heading('3. Variables JWT en .env.example', level=1)
doc.add_paragraph('Se señalan ÚNICAMENTE los nombres de las variables, sin mostrar secretos reales:')
doc.add_paragraph('• JWT_SECRET')
doc.add_paragraph('• JWT_EXPIRES_IN')
doc.add_heading('Contenido en .env.example:', level=2)
par = doc.add_paragraph()
run = par.add_run('# JWT\nJWT_SECRET=replace-with-a-long-random-local-secret-min-32-chars\nJWT_EXPIRES_IN=15m')
run.font.name = 'Courier New'
run.font.size = Pt(9)
doc.add_paragraph('El valor real de JWT_SECRET se encuentra únicamente en .env (archivo local no publicado).')

# 4
doc.add_heading('4. Registro, login y explicación del payload', level=1)
doc.add_paragraph('Cuenta de práctica utilizada: practica_sesion18@example.com')
doc.add_heading('Petición POST /auth/login:', level=2)
par = doc.add_paragraph()
run = par.add_run('curl -X POST http://localhost:3000/auth/login \\\n  -H "Content-Type: application/json" \\\n  -d \'{"email":"practica_sesion18@example.com","password":"Password123!"}\'')
run.font.name = 'Courier New'
run.font.size = Pt(8)
doc.add_heading('Respuesta (token truncado):', level=2)
par = doc.add_paragraph()
run = par.add_run('{\n  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9... [TRUNCADO]\n  "user": {\n    "id": 1,\n    "email": "practica_sesion18@example.com",\n    "createdAt": "..."\n  }\n}')
run.font.name = 'Courier New'
run.font.size = Pt(8)
doc.add_heading('¿Qué contiene el payload?', level=2)
doc.add_paragraph('Al decodificar el payload se observan: sub, email, iat, exp.')
doc.add_paragraph('• sub: ID del usuario')
doc.add_paragraph('• email: Correo del usuario')
doc.add_paragraph('• iat: Fecha de emisión')
doc.add_paragraph('• exp: Fecha de expiración')
doc.add_paragraph('Importante: JWT está firmado, NO cifrado. Nunca debe incluir password/passwordHash. El token se firma SOLO después de validar credenciales con bcrypt.')

# 5
doc.add_heading('5. Pruebas solicitadas', level=1)

doc.add_heading('A) GET /auth/me con Authorization: Bearer → 200 OK', level=2)
par = doc.add_paragraph()
run = par.add_run('curl -i -X GET http://localhost:3000/auth/me -H "Authorization: Bearer <TOKEN_TRUNCADO>"')
run.font.name = 'Courier New'
run.font.size = Pt(8)
doc.add_heading('Resultado:', level=3)
par = doc.add_paragraph()
run = par.add_run('HTTP/1.1 200 OK\n\n{"id": 1, "email": "practica_sesion18@example.com"}')
run.font.name = 'Courier New'
run.font.size = Pt(8)
doc.add_paragraph('Guard pasó, estrategia verificó firma+exp con JWT_SECRET, req.user contiene identidad mínima.')

doc.add_heading('B) GET /auth/me sin encabezado → 401 Unauthorized', level=2)
par = doc.add_paragraph()
run = par.add_run('curl -i -X GET http://localhost:3000/auth/me')
run.font.name = 'Courier New'
run.font.size = Pt(8)
par = doc.add_paragraph()
run = par.add_run('HTTP/1.1 401 Unauthorized')
run.font.name = 'Courier New'
run.font.size = Pt(8)

doc.add_heading('C) GET /auth/me con token ALTERADO → 401 Unauthorized', level=2)
doc.add_paragraph('Se modificó un solo carácter del token.')
par = doc.add_paragraph()
run = par.add_run('HTTP/1.1 401 Unauthorized')
run.font.name = 'Courier New'
run.font.size = Pt(8)
doc.add_paragraph('Al cambiar el token, la firma deja de coincidir con JWT_SECRET → rechazo.')

doc.add_heading('D) POST /courses SIN token → 401 (sin modificar datos)', level=2)
par = doc.add_paragraph()
run = par.add_run('curl -i -X POST http://localhost:3000/courses \\\n  -H "Content-Type: application/json" \\\n  -d \'{"title":"Curso Demo Sesion18","level":"Básico"}\'')
run.font.name = 'Courier New'
run.font.size = Pt(8)
par = doc.add_paragraph()
run = par.add_run('HTTP/1.1 401 Unauthorized')
run.font.name = 'Courier New'
run.font.size = Pt(8)
doc.add_paragraph('No se creó ningún registro. El JwtAuthGuard bloquea antes del controlador/servicio.')

doc.add_heading('E) POST /courses CON token válido → DTOs y reglas vigentes', level=2)
doc.add_heading('E1) Cuerpo correcto + token válido → 201 Created', level=3)
par = doc.add_paragraph()
run = par.add_run('curl -i -X POST http://localhost:3000/courses \\\n  -H "Content-Type: application/json" \\\n  -H "Authorization: Bearer <TOKEN_TRUNCADO>" \\\n  -d \'{"title":"Curso Demo Sesion18","level":"Básico"}\'')
run.font.name = 'Courier New'
run.font.size = Pt(8)
par = doc.add_paragraph()
run = par.add_run('HTTP/1.1 201 Created\n\n{"id": X, "title": "Curso Demo Sesion18", "level": "Básico"}')
run.font.name = 'Courier New'
run.font.size = Pt(8)

doc.add_heading('E2) Cuerpo inválido + token válido → 400 Bad Request', level=3)
par = doc.add_paragraph()
run = par.add_run('curl -i -X POST http://localhost:3000/courses \\\n  -H "Content-Type: application/json" \\\n  -H "Authorization: Bearer <TOKEN_TRUNCADO>" \\\n  -d \'{"title":123,"extra":"no-permitido"}\'')
run.font.name = 'Courier New'
run.font.size = Pt(8)
par = doc.add_paragraph()
run = par.add_run('HTTP/1.1 400 Bad Request\n\n{\n  "statusCode": 400,\n  "message": ["title must be a string", "property extra should not exist"],\n  "error": "Bad Request"\n}')
run.font.name = 'Courier New'
run.font.size = Pt(8)
doc.add_paragraph('Autenticación y Validación son capas distintas. Estar autenticado NO omite ValidationPipe (whitelist + forbidNonWhitelisted).')

# 6
doc.add_heading('6. Conclusiones', level=1)
doc.add_paragraph('• Autenticación = saber quién eres. Autorización = saber qué puedes hacer (Semana 10).')
doc.add_paragraph('• 401 = sin identidad válida (ausente/alterado/expirado/firma inválida).')
doc.add_paragraph('• 403 = identidad válida pero sin permiso.')
doc.add_paragraph('• JWT firmado con JWT_SECRET desde configuración validada con Joi.')
doc.add_paragraph('• JwtAuthGuard + JwtStrategy protegen rutas antes del controlador.')
doc.add_paragraph('• Solo identidad mínima (id, email) llega a req.user.')

doc.add_paragraph()
doc.add_paragraph(f'Elaborado: {datetime.now().strftime("%d/%m/%Y")}')

ruta = '/home/joseo/Descargas/Aplicaciones_de_servicios_web-main/SESION_18_Verificar_JWT_y_Proteger_Rutas.docx'
doc.save(ruta)
print(ruta)
