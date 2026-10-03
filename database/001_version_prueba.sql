USE sistema_visitas_hogares;
-- Ejecutar una sola vez sobre el esquema original. No elimina datos.
ALTER TABLE estudiantes ADD COLUMN codigo VARCHAR(30) NULL;
ALTER TABLE apoderados ADD COLUMN fallecido BOOLEAN NULL;
ALTER TABLE apoderados ADD COLUMN vive_otra_direccion BOOLEAN NULL;
ALTER TABLE apoderados ADD COLUMN parentesco_otro VARCHAR(100) NULL;
ALTER TABLE apoderados ADD COLUMN colaborador_acjg BOOLEAN NULL;
ALTER TABLE profesores ADD COLUMN codigo VARCHAR(30) NULL;
ALTER TABLE profesores ADD COLUMN curso VARCHAR(100) NULL;
ALTER TABLE profesores ADD COLUMN seccion VARCHAR(10) NULL;
ALTER TABLE usuarios ADD COLUMN intentos_fallidos INT NOT NULL DEFAULT 0;
ALTER TABLE usuarios ADD COLUMN bloqueado_hasta DATETIME NULL;
ALTER TABLE visitas ADD COLUMN motivo VARCHAR(120) NULL;
ALTER TABLE visitas ADD COLUMN estado ENUM('Pendiente','Programada','Realizada','Cancelada') NOT NULL DEFAULT 'Realizada';
ALTER TABLE visitas ADD COLUMN ficha_snapshot LONGTEXT NULL;
