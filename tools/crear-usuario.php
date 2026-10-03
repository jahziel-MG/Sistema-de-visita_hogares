<?php
if(PHP_SAPI!=='cli'){http_response_code(404);exit;}
require __DIR__.'/../backend/bootstrap.php';
echo "Crear usuario de intranet (no modifica usuarios existentes)\nUsuario: ";$name=trim(fgets(STDIN));
echo "Contraseña nueva, mínimo 12 caracteres (visible al escribir): ";$pw=trim(fgets(STDIN));
echo "Rol [ADMINISTRADOR / TUTOR / PROFESOR], Enter = ADMINISTRADOR: ";$role=trim(fgets(STDIN))?:'ADMINISTRADOR';
if(!preg_match('/^[a-zA-Z0-9_.-]{3,50}$/D',$name)||strlen($pw)<12||strlen($pw)>72||!in_array($role,['ADMINISTRADOR','TUTOR','PROFESOR'],true)){fwrite(STDERR,"Datos no válidos.\n");exit(1);}
try{query('INSERT INTO usuarios (usuario,password,rol) VALUES (?,?,?)',[$name,password_hash($pw,PASSWORD_DEFAULT),$role]);echo "Usuario creado. Ya puedes iniciar sesión.\n";}catch(Throwable $e){fwrite(STDERR,"No se pudo crear: revisa conexión, esquema y que el usuario no exista.\n");exit(1);}
