#!/bin/bash
# Demostración de la semana 5: los siete casos del enunciado.
# No simula nada: habla con la API real y con PostgreSQL de verdad.
# Cada paso imprime el comando, la respuesta HTTP y la verificación en la base.
#
# Uso:  npm run build && bash docs/demostracion.sh
# Deja los datos de ejemplo en la base. Para empezar de cero:
#   docker exec coursehub_db psql -U postgres -d coursehub-api \
#     -c "TRUNCATE enrollments, courses, students RESTART IDENTITY CASCADE;"

STARTDIR=$(pwd)
B=http://localhost:3000
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

# Los helpers de Node leen de un archivo: es más fiable que parsear con
# corchetes dentro de -pe, donde el shell estorba.
get() { node -e "
  const d=JSON.parse(require('fs').readFileSync(process.argv[1],'utf8'));
  const v=process.argv[2].split('.').reduce((a,k)=>a==null?a:a[isNaN(k)?k:Number(k)],d);
  process.stdout.write(String(v));
" "$1" "$2"; }

paso() { echo; echo "════════════════════════════════════════════════════════"; echo "$1"; echo "════════════════════════════════════════════════════════"; }
show() { echo "\$ $1"; }
api() { eval "$1"; echo; }
sql() { echo "En DBeaver:"; docker exec coursehub_db psql -U postgres -d coursehub-api -c "$1"; echo; }
code() { curl -s -o /dev/null -w "%{http_code}" "$@"; }

echo "CourseHub API · demostración de la semana 5"
echo "Persistencia con TypeORM sobre PostgreSQL"
echo "Base: coursehub-api en localhost:5434 · API en $B"
echo "Fecha: $(date '+%Y-%m-%d %H:%M:%S')"
echo
echo "Cómo leer este archivo: cada bloque corresponde a uno de los siete casos"
echo "del enunciado. Se muestra la petición tal como se envía y la respuesta"
echo "tal como vuelve, seguida de la comprobación en la base de datos."
echo
echo "Las consultas marcadas con «En DBeaver» se pueden copiar y pegar tal cual"
echo "en el editor SQL de DBeaver, sobre la conexión coursehub-api del puerto"
echo "5434. Ahí se ve que los datos no viven en la memoria del proceso."

paso "PASO 0 · Estado inicial: las tres tablas existen y están vacías"
sql "SELECT count(*) AS cursos FROM courses;"
sql "SELECT count(*) AS estudiantes FROM students;"
sql "SELECT count(*) AS matrículas FROM enrollments;"
echo "Las tablas no estaban en memoria: viven en PostgreSQL desde el arranque."

paso "PASO 1 · Crear un curso y un estudiante activo"
echo "--- curso ---"
show "POST /courses"
curl -s -X POST $B/courses -H 'Content-Type: application/json' \
  -d '{"title":"Semana 5 · Relaciones persistentes","level":"intermediate"}' > "$TMP/c1"
cat "$TMP/c1"; echo
CID=$(get "$TMP/c1" id)
echo "  CID = $CID"
echo
echo "--- un segundo curso, para probar el filtro por curso ---"
curl -s -X POST $B/courses -H 'Content-Type: application/json' \
  -d '{"title":"Curso de apoyo","level":"beginner"}' > "$TMP/c2"
cat "$TMP/c2"; echo
CID2=$(get "$TMP/c2" id)
echo "  CID2 = $CID2"
echo
echo "--- estudiante activo ---"
show "POST /students"
curl -s -X POST $B/students -H 'Content-Type: application/json' \
  -d '{"name":"Ana Ruiz","email":"ana.ruiz@example.com","age":20,"career":"Computer Science","semester":5}' > "$TMP/s1"
cat "$TMP/s1"; echo
SID=$(get "$TMP/s1" id)
echo "  SID = $SID"
echo
echo "--- segundo estudiante, para probar el filtro por estudiante ---"
curl -s -X POST $B/students -H 'Content-Type: application/json' \
  -d '{"name":"Luis Paz","email":"luis.paz@example.com","age":22,"career":"Mathematics","semester":3}' > "$TMP/s2"
cat "$TMP/s2"; echo
SID2=$(get "$TMP/s2" id)
echo "  SID2 = $SID2"
echo
echo "isActive no se envió en el cuerpo: la columna lo define como true por defecto."
echo "Ana queda activa y es quien matrícularemos. Luis queda activo también."
sql 'SELECT id, name, "isActive" FROM students ORDER BY id;'

paso "PASO 2 · Crear una matrícula válida"
show "POST /enrollments   {\"studentId\":$SID,\"courseId\":$CID}"
# Una sola llamada: la respuesta se guarda y de ahí se lee el id.
# Si se pidiera dos veces, la segunda sería ya el duplicado del paso 4.
curl -s -w '\n%{http_code}' -X POST $B/enrollments -H 'Content-Type: application/json' \
  -d "{\"studentId\":$SID,\"courseId\":$CID}" > "$TMP/e1"
grep -v '^2[0-9][0-9]$' "$TMP/e1" > "$TMP/e1.body"
cat "$TMP/e1.body"; echo
echo "HTTP $(tail -1 "$TMP/e1")"
echo
EID=$(get "$TMP/e1.body" id)
echo "  EID = $EID"
echo
echo "La respuesta trae el estudiante y el curso relacionados, no solo los ids."
echo "Guardamos esa matrícula para los pasos siguientes."
sql "SELECT id, student_id, course_id FROM enrollments WHERE id = $EID;"
echo "Las columnas student_id y course_id son claves foráneas generadas por TypeORM,"
echo "no números guardados sueltos."

paso "PASO 3 · Reiniciar la API y consultar la misma matrícula"
PID=$(pgrep -f "dist/main")
echo "Deteniendo la API (pid $PID)..."
kill -9 $PID 2>/dev/null
sleep 2
echo "Arrancando de nuevo..."
cd "$(dirname "$0")/.." || exit 1
setsid nohup node dist/main > /tmp/coursehub-ev-restart.log 2>&1 < /dev/null &
sleep 9
cd "$STARTDIR" || exit 1
echo "API reiniciada, con el mismo proceso y sin tocar la base de datos."
echo
echo "--- ahora consultamos la matrícula creada ANTES del reinicio ---"
show "GET /enrollments?studentId=$SID"
curl -s -w '\nHTTP %{http_code}' $B/enrollments?studentId=$SID
echo
echo "Si los datos estuvieran en memoria, esta lista vendría vacía."
sql "SELECT id, student_id, course_id FROM enrollments WHERE id = $EID;"

paso "PASO 4 · Intentar una matrícula duplicada (se espera 409)"
show "POST /enrollments   {\"studentId\":$SID,\"courseId\":$CID}   (la misma pareja)"
curl -s -w '\nHTTP %{http_code}' -X POST $B/enrollments -H 'Content-Type: application/json' \
  -d "{\"studentId\":$SID,\"courseId\":$CID}"
echo
echo "El servicio comprueba primero y responde 409 con un mensaje comprensible."
echo
echo "Y si el servicio no lo comprobara, la base lo impediría igualmente."
echo "Esta es la restricción única compuesta sobre (student_id, course_id):"
sql "SELECT conname, pg_get_constraintdef(oid) AS definicion
FROM pg_constraint
WHERE conrelid = 'enrollments'::regclass AND contype = 'u';"
echo "Y sigue habiendo una sola fila para esa pareja, no dos:"
sql "SELECT count(*) AS filas_para_la_pareja
FROM enrollments WHERE student_id = $SID AND course_id = $CID;"

paso "PASO 5 · Intentar matrícular un estudiante inactivo (se espera 400)"
echo "--- desactivamos a Ana ---"
show "PATCH /students/$SID/status   {\"isActive\":false}"
curl -s -w '\nHTTP %{http_code}' -X PATCH $B/students/$SID/status \
  -H 'Content-Type: application/json' -d '{"isActive":false}'
echo
sql "SELECT id, name, \"isActive\" FROM students WHERE id = $SID;"
echo "Ana ya está en el mismo curso que antes, así que para que el 400 sea por"
echo "inactividad y no por duplicado, la probamos contra el otro curso ($CID2):"
echo
show "POST /enrollments   {\"studentId\":$SID,\"courseId\":$CID2}"
curl -s -w '\nHTTP %{http_code}' -X POST $B/enrollments -H 'Content-Type: application/json' \
  -d "{\"studentId\":$SID,\"courseId\":$CID2}"
echo
echo "El orden de las comprobaciones permite explicar el motivo exacto del fallo:"
echo "  estudiante inexistente -> 404        curso inexistente -> 404"
echo "  estudiante inactivo    -> 400        pareja repetida    -> 409"
echo
echo "No se creó ninguna fila nueva:"
sql "SELECT count(*) AS matrículas_de_ana FROM enrollments WHERE student_id = $SID;"
echo "--- reactivamos a Ana ---"
curl -s -o /dev/null -X PATCH $B/students/$SID/status \
  -H 'Content-Type: application/json' -d '{"isActive":true}'
sql "SELECT id, name, \"isActive\" FROM students WHERE id = $SID;"

paso "PASO 6 · Filtrar las matrículas por estudiante o por curso"
echo "--- filtrar por estudiante (Ana) ---"
show "GET /enrollments?studentId=$SID"
curl -s $B/enrollments?studentId=$SID; echo
echo
echo "--- filtrar por curso (Semana 5) ---"
show "GET /enrollments?courseId=$CID"
curl -s $B/enrollments?courseId=$CID; echo
echo
echo "--- los dos filtros a la vez: son combinables ---"
show "GET /enrollments?studentId=$SID&courseId=$CID"
curl -s "$B/enrollments?studentId=$SID&courseId=$CID"; echo
echo
echo "--- matrículas de Ana desde su propio recurso ---"
show "GET /students/$SID/enrollments"
curl -s $B/students/$SID/enrollments; echo
echo
echo "--- matrículas del curso Semana 5 desde su propio recurso ---"
show "GET /courses/$CID/enrollments"
curl -s $B/courses/$CID/enrollments; echo
echo
echo "--- sin filtros: todas las matrículas ---"
show "GET /enrollments"
curl -s $B/enrollments; echo
echo
echo "Verificación cruzada en la base, con los nombres de cada lado:"
sql "SELECT e.id, s.name AS estudiante, c.title AS curso
FROM enrollments e
JOIN students s ON s.id = e.student_id
JOIN courses  c ON c.id = e.course_id
ORDER BY e.id;"

paso "PASO 7 · Cancelar la matrícula y comprobar que ya no se encuentra"
echo "--- antes de cancelar: la integridad referencial está activa ---"
echo "Ana y el curso Semana 5 están enlazados por la matrícula $EID."
echo "Por eso no se pueden borrar, y la API responde 409 en vez del 500"
echo "crudo que devolvería PostgreSQL:"
echo "  DELETE /courses/$CID   -> HTTP $(code -X DELETE $B/courses/$CID)"
echo "  DELETE /students/$SID  -> HTTP $(code -X DELETE $B/students/$SID)"
echo
echo "Las claves foráneas que causan ese bloqueo:"
sql "SELECT conname, pg_get_constraintdef(oid) AS definicion
FROM pg_constraint
WHERE conrelid = 'enrollments'::regclass AND contype = 'f'
ORDER BY conname;"
echo "ON DELETE RESTRICT impide borrar un estudiante o curso que aún tenga"
echo "matrículas. El orden importa: hay que cancelar antes de poder borrar."
echo
echo "--- estado antes de cancelar ---"
sql "SELECT id, student_id, course_id FROM enrollments WHERE id = $EID;"
echo "--- cancelamos ---"
show "DELETE /enrollments/$EID"
echo "HTTP $(code -X DELETE $B/enrollments/$EID)"
echo "204 No Content. El DELETE no devuelve cuerpo: la acción ya se hizo."
echo
echo "--- la lista ya no la contiene ---"
show "GET /enrollments"
curl -s $B/enrollments; echo
echo
echo "--- y la misma matrícula ya no se encuentra ---"
show "DELETE /enrollments/$EID   (otra vez)"
curl -s -w '\nHTTP %{http_code}' -X DELETE $B/enrollments/$EID
echo
echo "Cancelar la matrícula borra el vínculo, no el estudiante ni el curso:"
sql "SELECT count(*) AS estudiantes_vivos FROM students WHERE id = $SID;"
sql "SELECT count(*) AS cursos_vivos FROM courses WHERE id = $CID;"
echo
echo "--- ahora que no quedan matrículas, los mismos borrados sí funcionan ---"
echo "Antes devolvían 409 por la clave foránea. La diferencia es el vínculo:"
echo "  DELETE /courses/$CID   -> HTTP $(code -X DELETE $B/courses/$CID)"
echo "  DELETE /students/$SID  -> HTTP $(code -X DELETE $B/students/$SID)"

paso "Comprobaciones adicionales de integridad"
echo "--- correo único: la API lo comprueba antes de llegar a la base ---"
echo "Se reintenta el correo de Luis ($SID2), que sigue existiendo:"
show "POST /students con un correo que ya existe"
curl -s -w '\nHTTP %{http_code}' -X POST $B/students -H 'Content-Type: application/json' \
  -d '{"name":"Repetido","email":"luis.paz@example.com","age":25,"career":"Data","semester":7}'
echo
echo "Los índices que respaldan esa regla en la tabla students:"
sql "SELECT indexname FROM pg_indexes WHERE tablename = 'students';"
echo "Y no se creó una tercera estudiante con el mismo correo:"
sql "SELECT id, name, email FROM students ORDER BY id;"
echo "--- recursos inexistentes y parámetros inválidos ---"
echo "  GET /courses/999999        -> HTTP $(code $B/courses/999999)   (recurso inexistente)"
echo "  GET /courses/abc           -> HTTP $(code $B/courses/abc)      (id no numérico)"
echo "  DELETE /enrollments/999999 -> HTTP $(code -X DELETE $B/enrollments/999999)   (recurso inexistente)"
echo "  DELETE /courses/abc        -> HTTP $(code -X DELETE $B/courses/abc)"
echo
echo "--- validación de cuerpo: propiedad desconocida rechazada ---"
show "POST /courses con un campo id que el cliente no debería enviar"
curl -s -w '\nHTTP %{http_code}' -X POST $B/courses -H 'Content-Type: application/json' \
  -d '{"title":"Con propiedad extra","level":"beginner","id":42}'
echo
echo "--- esquema final de la tabla de matrículas ---"
sql "SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'enrollments' ORDER BY ordinal_position;"

paso "Resumen de los siete casos"
echo "  1. Curso y estudiante activo creados ............ HTTP 201, filas en PostgreSQL"
echo "  2. Matrícula válida creada ..................... HTTP 201, con ambas relaciones"
echo "  3. API reiniciada, la matrícula sigue ahí ...... HTTP 200, no se perdió nada"
echo "  4. Pareja repetida .............................. HTTP 409 Conflict"
echo "  5. Estudiante inactivo............................ HTTP 400 Bad Request"
echo "  6. Filtros por estudiante, por curso y ambos .... HTTP 200, cada uno restringe"
echo "  7. Matrícula cancelada .......................... HTTP 204, luego HTTP 404"

echo
echo "ids usados:  CID=$CID  CID2=$CID2  SID=$SID  SID2=$SID2  EID=$EID"