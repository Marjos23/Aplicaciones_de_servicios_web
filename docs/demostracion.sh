#!/usr/bin/env bash
# Demostración de los casos exigidos por la evaluación (CourseHub API).
# Uso: con la API en ejecución (npm run start / node dist/main.js)
#   bash docs/demostracion.sh

set -u

BASE="http://localhost:3000"

show() {
  local title="$1"
  shift
  echo ""
  echo "============================================================"
  echo "# $title"
  echo "============================================================"
  echo "-> $*"
  local body
  local code
  body=$(curl -s --max-time 5 -w "\n%{http_code}" "$@")
  code=$(printf '%s' "$body" | tail -n1)
  printf 'HTTP %s\n' "$code"
  local out
  out=$(printf '%s' "$body" | sed '$d')
  if printf '%s' "$out" | grep -qE '^[[:space:]]*[\{\[]'; then
    printf '%s' "$out" | jq . 2>/dev/null || printf '%s\n' "$out"
  else
    printf '%s\n' "$out"
  fi
}

echo "############ DATOS BASE ############"
show "Bienvenida" "$BASE/"
show "Cursos disponibles" "$BASE/courses"
show "Estudiantes (id 3 = Mariana Gómez, INACTIVA)" "$BASE/students"

echo ""
echo "############ 1) MATRÍCULA VÁLIDA ############"
show "POST /enrollments (Ana=1 en curso 2) -> 201" \
  -X POST "$BASE/enrollments" -H 'Content-Type: application/json' \
  -d '{"studentId":1,"courseId":2}'

echo ""
echo "############ 2) MATRÍCULA DUPLICADA ############"
show "POST /enrollments repetido (Ana=1, curso=2) -> 409" \
  -X POST "$BASE/enrollments" -H 'Content-Type: application/json' \
  -d '{"studentId":1,"courseId":2}'

echo ""
echo "############ 3) ESTUDIANTE INACTIVO ############"
show "POST /enrollments con estudiante inactivo (Mariana=3) -> 400" \
  -X POST "$BASE/enrollments" -H 'Content-Type: application/json' \
  -d '{"studentId":3,"courseId":1}'

echo ""
echo "############ 4) RECURSO INEXISTENTE ############"
show "POST /enrollments estudiante inexistente (999) -> 404" \
  -X POST "$BASE/enrollments" -H 'Content-Type: application/json' \
  -d '{"studentId":999,"courseId":1}'
show "POST /enrollments curso inexistente (999) -> 404" \
  -X POST "$BASE/enrollments" -H 'Content-Type: application/json' \
  -d '{"studentId":1,"courseId":999}'
show "DELETE /enrollments/999 -> 404" -X DELETE "$BASE/enrollments/999"

echo ""
echo "############ 5) IDENTIFICADOR DE RUTA INVÁLIDO (Pipe) ############"
show "GET /courses/abc -> 400 (ParsePositiveIntPipe)" "$BASE/courses/abc"
show "GET /students/-5/enrollments -> 400" "$BASE/students/-5/enrollments"

echo ""
echo "############ 6) VALIDACIÓN DTO (whitelist / forbidNonWhitelisted) ############"
show "POST /enrollments con campo no permitido -> 400" \
  -X POST "$BASE/enrollments" -H 'Content-Type: application/json' \
  -d '{"studentId":1,"courseId":1,"hack":true}'
show "POST /enrollments con tipo inválido -> 400" \
  -X POST "$BASE/enrollments" -H 'Content-Type: application/json' \
  -d '{"studentId":"uno","courseId":1}'

echo ""
echo "############ 7) FILTROS COMBINABLES ############"
show "GET /enrollments (todas)" "$BASE/enrollments"
show "GET /enrollments?studentId=1" "$BASE/enrollments?studentId=1"
show "GET /enrollments?courseId=1" "$BASE/enrollments?courseId=1"
show "GET /enrollments?studentId=1&courseId=1 (combinado)" \
  "$BASE/enrollments?studentId=1&courseId=1"

echo ""
echo "############ 8) CONSULTAS ANIDADAS ############"
show "GET /students/1/enrollments" "$BASE/students/1/enrollments"
show "GET /courses/1/enrollments" "$BASE/courses/1/enrollments"

echo ""
echo "############ 9) CANCELAR MATRÍCULA ############"
show "DELETE /enrollments/1 -> 200" -X DELETE "$BASE/enrollments/1"
show "GET /enrollments tras cancelar" "$BASE/enrollments"
