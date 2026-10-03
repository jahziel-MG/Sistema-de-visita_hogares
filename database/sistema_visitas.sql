-- ============================================================
-- SISTEMA DE VISITAS A HOGARES
-- Base de datos MySQL
-- Basado en la "Ficha de Visitas a Hogares 2026"
-- ============================================================

CREATE DATABASE IF NOT EXISTS sistema_visitas_hogares
CHARACTER SET utf8mb4
COLLATE utf8mb4_unicode_ci;

USE sistema_visitas_hogares;

-- ============================================================
-- 1. ESTUDIANTES
-- ============================================================
CREATE TABLE estudiantes (
    id_estudiante INT AUTO_INCREMENT PRIMARY KEY,
    apellidos VARCHAR(100) NOT NULL,
    nombres VARCHAR(100) NOT NULL,
    dni VARCHAR(8) NULL,
    grado VARCHAR(20) NOT NULL,
    seccion VARCHAR(10) NOT NULL,
    direccion VARCHAR(200) NULL,
    zona VARCHAR(100) NULL,
    distrito VARCHAR(100) NULL,
    telefono_fijo VARCHAR(20) NULL,
    fecha_nacimiento DATE NULL,
    lugar_como_hijo INT NULL,
    total_hermanos_casa INT DEFAULT 0,
    con_quien_vive VARCHAR(150) NULL,
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    actualizado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_estudiantes_dni (dni)
) ENGINE=InnoDB;

-- ============================================================
-- 2. APODERADOS / FAMILIARES
-- ============================================================
CREATE TABLE apoderados (
    id_apoderado INT AUTO_INCREMENT PRIMARY KEY,
    id_estudiante INT NOT NULL,
    tipo_apoderado ENUM(
        'PADRE',
        'MADRE',
        'PADRE_POLITICO',
        'MADRE_POLITICA',
        'CONVIVIENTE',
        'TIO',
        'TIA',
        'ABUELO',
        'ABUELA',
        'OTRO'
    ) NOT NULL,
    nombres_apellidos VARCHAR(150) NOT NULL,
    dni VARCHAR(8) NULL,
    telefono_fijo VARCHAR(20) NULL,
    celular VARCHAR(20) NULL,
    email VARCHAR(120) NULL,
    direccion VARCHAR(200) NULL,
    distrito VARCHAR(100) NULL,
    fecha_nacimiento DATE NULL,
    estado_civil ENUM(
        'CASADO',
        'CASADA',
        'CONVIVIENTE',
        'SOLTERO',
        'SOLTERA',
        'VIUDO',
        'VIUDA',
        'SEPARADO',
        'SEPARADA',
        'DIVORCIADO',
        'DIVORCIADA',
        'OTRO'
    ) NULL,

    grado_instruccion VARCHAR(100) NULL,
    profesion VARCHAR(100) NULL,
    oficio_ocupacion VARCHAR(100) NULL,

    descripcion_trabajo VARCHAR(180) NULL,
    tipo_trabajo ENUM('FIJO', 'EMPRESA', 'INDEPENDIENTE', 'EVENTUAL', 'OTRO') NULL,
    empresa VARCHAR(150) NULL,

    ingreso_trabajo DECIMAL(10,2) DEFAULT 0.00,
    otros_ingresos DECIMAL(10,2) DEFAULT 0.00,
    total_ingresos DECIMAL(10,2) DEFAULT 0.00,

    horario_desde TIME NULL,
    horario_hasta TIME NULL,
    horas_diarias DECIMAL(4,2) NULL,
    trabajo_rotativo BOOLEAN DEFAULT FALSE,

    tiene_seguro BOOLEAN DEFAULT FALSE,
    seguro VARCHAR(100) NULL,

    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_apoderados_estudiante
        FOREIGN KEY (id_estudiante)
        REFERENCES estudiantes(id_estudiante)
        ON UPDATE CASCADE
        ON DELETE CASCADE
) ENGINE=InnoDB;

-- ============================================================
-- 3. PROFESORES / TUTORES / ENCARGADOS
-- ============================================================
CREATE TABLE profesores (
    id_profesor INT AUTO_INCREMENT PRIMARY KEY,
    nombres VARCHAR(100) NOT NULL,
    apellidos VARCHAR(100) NOT NULL,
    dni VARCHAR(8) NULL,
    email VARCHAR(120) NULL,
    telefono VARCHAR(20) NULL,
    cargo VARCHAR(60) NULL,
    estado BOOLEAN DEFAULT TRUE,
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_profesores_dni (dni)
) ENGINE=InnoDB;

-- ============================================================
-- 4. USUARIOS DE LA INTRANET
-- ============================================================
CREATE TABLE usuarios (
    id_usuario INT AUTO_INCREMENT PRIMARY KEY,
    id_profesor INT NULL,
    usuario VARCHAR(50) NOT NULL,
    password VARCHAR(255) NOT NULL,
    rol ENUM('ADMINISTRADOR', 'TUTOR', 'PROFESOR') DEFAULT 'PROFESOR',
    estado BOOLEAN DEFAULT TRUE,
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ultimo_acceso DATETIME NULL,

    UNIQUE KEY uk_usuarios_usuario (usuario),

    CONSTRAINT fk_usuarios_profesor
        FOREIGN KEY (id_profesor)
        REFERENCES profesores(id_profesor)
        ON UPDATE CASCADE
        ON DELETE SET NULL
) ENGINE=InnoDB;

-- ============================================================
-- 5. VISITAS AL HOGAR
-- ============================================================
CREATE TABLE visitas (
    id_visita INT AUTO_INCREMENT PRIMARY KEY,
    id_estudiante INT NOT NULL,
    id_profesor INT NOT NULL,
    fecha_visita DATE NOT NULL,

    ambiente_individual BOOLEAN NULL,
    cama_propia BOOLEAN NULL,

    responsable_matricula VARCHAR(150) NULL,
    quien_controla_tareas VARCHAR(120) NULL,
    lugar_estudio VARCHAR(120) NULL,
    quien_supervisa_quehaceres VARCHAR(120) NULL,
    responsabilidades VARCHAR(200) NULL,
    trabaja BOOLEAN DEFAULT FALSE,
    actividad VARCHAR(150) NULL,

    correo_responsable VARCHAR(120) NULL,
    observaciones TEXT NULL,

    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    actualizado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_visitas_estudiante
        FOREIGN KEY (id_estudiante)
        REFERENCES estudiantes(id_estudiante)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT fk_visitas_profesor
        FOREIGN KEY (id_profesor)
        REFERENCES profesores(id_profesor)
        ON UPDATE CASCADE
        ON DELETE RESTRICT
) ENGINE=InnoDB;

-- ============================================================
-- 6. SALUD
-- ============================================================
CREATE TABLE salud (
    id_salud INT AUTO_INCREMENT PRIMARY KEY,
    id_visita INT NOT NULL,
    tiene_necesidad BOOLEAN DEFAULT FALSE,
    diagnostico TEXT NULL,
    lugar_tratamiento VARCHAR(200) NULL,
    tratamiento_terapia TEXT NULL,

    UNIQUE KEY uk_salud_visita (id_visita),

    CONSTRAINT fk_salud_visita
        FOREIGN KEY (id_visita)
        REFERENCES visitas(id_visita)
        ON UPDATE CASCADE
        ON DELETE CASCADE
) ENGINE=InnoDB;

-- ============================================================
-- 7. VIVIENDA
-- ============================================================
CREATE TABLE vivienda (
    id_vivienda INT AUTO_INCREMENT PRIMARY KEY,
    id_visita INT NOT NULL,

    tenencia ENUM('PROPIA', 'ALQUILADA', 'ALOJADO', 'GUARDIANIA', 'OTRO') NULL,
    monto_alquiler DECIMAL(10,2) NULL,

    tipo_vivienda ENUM('UNIFAMILIAR', 'MULTIFAMILIAR', 'OTRO') NULL,
    material ENUM('NOBLE', 'ADOBE', 'ESTERA', 'MADERA', 'OTRO') NULL,
    material_otro VARCHAR(100) NULL,

    agua_red BOOLEAN DEFAULT FALSE,
    desague BOOLEAN DEFAULT FALSE,
    luz BOOLEAN DEFAULT FALSE,
    cable BOOLEAN DEFAULT FALSE,
    internet BOOLEAN DEFAULT FALSE,
    telefono_fijo BOOLEAN DEFAULT FALSE,
    cantidad_celulares INT DEFAULT 0,

    servicio_higienico ENUM('INDEPENDIENTE', 'COMUN', 'SILO', 'OTRO') NULL,

    orden ENUM('BUENO', 'REGULAR', 'DEFICIENTE') NULL,
    limpieza ENUM('BUENO', 'REGULAR', 'DEFICIENTE') NULL,
    mobiliario ENUM('BUENO', 'REGULAR', 'DEFICIENTE') NULL,

    UNIQUE KEY uk_vivienda_visita (id_visita),

    CONSTRAINT fk_vivienda_visita
        FOREIGN KEY (id_visita)
        REFERENCES visitas(id_visita)
        ON UPDATE CASCADE
        ON DELETE CASCADE
) ENGINE=InnoDB;

-- ============================================================
-- 8. ÁREA ESPIRITUAL
-- Una fila por PADRE, MADRE o HIJO en cada visita.
-- ============================================================
CREATE TABLE area_espiritual (
    id_area INT AUTO_INCREMENT PRIMARY KEY,
    id_visita INT NOT NULL,
    persona ENUM('PADRE', 'MADRE', 'HIJO') NOT NULL,

    confesion_religiosa VARCHAR(100) NULL,
    asiste_iglesia BOOLEAN NULL,
    nombre_iglesia VARCHAR(150) NULL,
    lugar VARCHAR(150) NULL,
    es_miembro BOOLEAN NULL,
    nombre_pastor_sacerdote VARCHAR(150) NULL,
    participo_campamento BOOLEAN NULL,

    UNIQUE KEY uk_area_visita_persona (id_visita, persona),

    CONSTRAINT fk_area_visita
        FOREIGN KEY (id_visita)
        REFERENCES visitas(id_visita)
        ON UPDATE CASCADE
        ON DELETE CASCADE
) ENGINE=InnoDB;

-- ============================================================
-- ÍNDICES ÚTILES PARA BÚSQUEDAS DEL SISTEMA
-- ============================================================
CREATE INDEX idx_estudiantes_apellidos
ON estudiantes(apellidos);

CREATE INDEX idx_visitas_fecha
ON visitas(fecha_visita);

CREATE INDEX idx_visitas_estudiante
ON visitas(id_estudiante);

CREATE INDEX idx_apoderados_estudiante
ON apoderados(id_estudiante);

-- ============================================================
-- FIN DEL SCRIPT
-- ============================================================
