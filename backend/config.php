<?php
// XAMPP local: cambie estos valores si su MySQL utiliza otra cuenta o puerto.
return [
    'host' => getenv('DB_HOST') ?: '127.0.0.1',
    'port' => getenv('DB_PORT') ?: '3306',
    'database' => getenv('DB_NAME') ?: 'sistema_visitas_hogares',
    'user' => getenv('DB_USER') ?: 'root',
    'password' => getenv('DB_PASS') !== false ? getenv('DB_PASS') : '',
];
