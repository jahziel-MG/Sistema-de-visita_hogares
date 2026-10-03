# Sistema de Visitas a Hogares

Prototipo funcional de intranet escolar para registrar y consultar visitas a hogares de estudiantes.

## Arquitectura

`HTML + CSS + JavaScript -> fetch() -> API PHP/PDO -> MySQL`

## Estructura principal

- `frontend/`: interfaz, estilos, navegación y formularios.
- `backend/`: API, conexión PDO, validaciones, sesiones y lógica del servidor.
- `database/`: esquema MySQL y migración de la versión de prueba.
- `tools/crear-usuario.php`: utilidad local para crear usuarios con contraseña segura.
- `index.php`: entrada del proyecto y redirección a la interfaz.

## Ejecutar con XAMPP

1. Copia la carpeta `Sistema-Visitas-Hogares-PRESENTACION` dentro de `C:\xampp\htdocs\`.
2. Inicia Apache y MySQL desde XAMPP.
3. En phpMyAdmin importa `database/sistema_visitas.sql` si la base aún no existe.
4. Después importa una sola vez `database/001_version_prueba.sql`.
5. Revisa `backend/config.php`. Por defecto usa `127.0.0.1`, puerto `3306`, base `sistema_visitas_hogares`, usuario `root` y contraseña vacía.
6. Crea un usuario desde PowerShell:

```powershell
cd C:\xampp\htdocs\Sistema-Visitas-Hogares-PRESENTACION
& C:\xampp\php\php.exe tools\crear-usuario.php
```

7. Abre `http://localhost/Sistema-Visitas-Hogares-PRESENTACION/`.

> El sistema debe abrirse con Apache/XAMPP, no con doble clic ni Live Server, porque el frontend necesita comunicarse con PHP.

## Flujo para demostrar el prototipo

1. Iniciar sesión.
2. Registrar un estudiante.
3. Registrar un profesor.
4. Registrar o asociar apoderados.
5. Registrar una visita y completar sus secciones.
6. Consultar la ficha guardada.
7. Buscar, filtrar, editar o imprimir visitas.

## API

El frontend se comunica con `backend/api.php?resource=...` mediante `fetch()` y JSON.

Recursos principales: `session`, `login`, `logout`, `dashboard`, `schema`, `estudiantes`, `profesores`, `apoderados` y `visitas`.

- `GET`: consultar.
- `POST`: registrar.
- `PUT`: actualizar.
- `DELETE`: eliminar (solo administrador).

Las consultas a MySQL se realizan con PDO y sentencias preparadas. Las contraseñas se almacenan con `password_hash()` y se verifican con `password_verify()`.

## Archivos que no están en esta versión de presentación

La documentación extensa, el frontend anterior, la ficha PDF de referencia y la prueba automática se separaron del proyecto ejecutable porque no son necesarios para que el sistema funcione. Se entregan en un paquete aparte.
