<?php
declare(strict_types=1);
require __DIR__.'/bootstrap.php';
ini_set('display_errors','0');
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');header('X-Content-Type-Options: nosniff');
session_name('visitas_session');
session_set_cookie_params(['httponly'=>true,'samesite'=>'Strict','secure'=>!empty($_SERVER['HTTPS'])&&$_SERVER['HTTPS']!=='off','path'=>'/']);
ini_set('session.use_strict_mode','1');session_start();
try {
    $method=$_SERVER['REQUEST_METHOD'];$resource=$_GET['resource']??'session';
    if(!in_array($method,['GET','POST','PUT','DELETE'],true))fail('Método no permitido.',405);
    $input=[];
    if($method!=='GET') {
        if((int)($_SERVER['CONTENT_LENGTH']??0)>1000000)fail('La solicitud es demasiado grande.',413);
        try {$input=json_decode(file_get_contents('php://input'),true,64,JSON_THROW_ON_ERROR);}catch(JsonException $e){fail('JSON no válido.',400);}
        if(!is_array($input))fail('Solicitud no válida.',400);
        if(!isset($_SESSION['csrf'])||!hash_equals($_SESSION['csrf'],$_SERVER['HTTP_X_CSRF_TOKEN']??''))fail('La sesión cambió. Recarga la página.',403);
    }
    $_SESSION['csrf']??=bin2hex(random_bytes(32));
    if($resource==='login'&&$method==='POST') {
        $u=trim((string)($input['usuario']??''));$pw=(string)($input['password']??'');
        if(strlen($u)>50||strlen($pw)>200)fail('Credenciales no válidas.',401);
        db()->beginTransaction();
        $user=query('SELECT * FROM usuarios WHERE usuario=? FOR UPDATE',[$u])->fetch();
        if($user&&!empty($user['bloqueado_hasta'])&&strtotime($user['bloqueado_hasta'])>time()){db()->commit();fail('Demasiados intentos. Intenta de nuevo en 15 minutos.',429);}
        if(!$user||!$user['estado']||!password_verify($pw,$user['password'])) {
            if($user)query('UPDATE usuarios SET intentos_fallidos=intentos_fallidos+1, bloqueado_hasta=IF(intentos_fallidos>=5, DATE_ADD(NOW(), INTERVAL 15 MINUTE), NULL) WHERE id_usuario=?',[$user['id_usuario']]);
            db()->commit();fail('Usuario o contraseña incorrectos.',401);
        }
        query('UPDATE usuarios SET ultimo_acceso=NOW(), intentos_fallidos=0, bloqueado_hasta=NULL WHERE id_usuario=?',[$user['id_usuario']]);
        if(password_needs_rehash($user['password'],PASSWORD_DEFAULT))query('UPDATE usuarios SET password=? WHERE id_usuario=?',[password_hash($pw,PASSWORD_DEFAULT),$user['id_usuario']]);
        db()->commit();session_regenerate_id(true);$_SESSION['uid']=$user['id_usuario'];$_SESSION['last']=time();$_SESSION['csrf']=bin2hex(random_bytes(32));reply(['csrf'=>$_SESSION['csrf']]);
    }
    $user=null;
    if(isset($_SESSION['uid'])&&time()-($_SESSION['last']??0)<3600) $user=query('SELECT id_usuario, usuario, rol FROM usuarios WHERE id_usuario=? AND estado=1',[$_SESSION['uid']])->fetch()?:null;
    if($resource==='session'&&$method==='GET')reply(['user'=>$user,'csrf'=>$_SESSION['csrf']]);
    if(!$user)fail('Inicia sesión para continuar.',401);
    $_SESSION['last']=time();
    if($resource==='logout'&&$method==='POST'){$_SESSION=[];session_destroy();reply(true);}
    if($resource==='schema'&&$method==='GET')reply(schema());
    if($method==='DELETE'&&$user['rol']!=='ADMINISTRADOR')fail('Solo un administrador puede eliminar registros.',403);
    if($resource==='dashboard'&&$method==='GET') {
        $counts=[];foreach(['estudiantes','profesores','visitas'] as $t)$counts[$t]=(int)query("SELECT COUNT(*) FROM `$t`")->fetchColumn();
        $counts['pendientes']=(int)query("SELECT COUNT(*) FROM visitas WHERE estado IN ('Pendiente','Programada')")->fetchColumn();
        $recent=query("SELECT v.id_visita,v.fecha_visita,v.estado,v.motivo,CONCAT(e.apellidos,', ',e.nombres) estudiante,CONCAT(p.nombres,' ',p.apellidos) profesor FROM visitas v JOIN estudiantes e USING(id_estudiante) JOIN profesores p USING(id_profesor) ORDER BY v.fecha_visita DESC,v.id_visita DESC LIMIT 6")->fetchAll();
        reply(['counts'=>$counts,'recent'=>$recent]);
    }
    if(!isset(schema()[$resource]))fail('Ruta no encontrada.',404);
    $id=isset($_GET['id'])?filter_var($_GET['id'],FILTER_VALIDATE_INT,['options'=>['min_range'=>1]]):null;
    if(isset($_GET['id'])&&!$id)fail('Identificador no válido.');
    if($method==='GET') {
        if($id)reply($resource==='visitas'?visitDetail($id):row($resource,$id));
        $q=trim((string)($_GET['q']??''));$params=[];$where=[];
        $pk=schema()[$resource]['pk'];
        if($resource==='visitas'){$from='visitas t JOIN estudiantes e USING(id_estudiante) JOIN profesores p USING(id_profesor)';$select="t.id_visita,t.id_estudiante,t.id_profesor,t.fecha_visita,t.estado,t.motivo,CONCAT(e.apellidos,', ',e.nombres) estudiante,CONCAT(p.nombres,' ',p.apellidos) profesor";$search=['e.nombres','e.apellidos','p.nombres','p.apellidos','t.motivo'];}
        else {$from="`$resource` t";$select='t.*';$search=$resource==='apoderados'?['t.nombres_apellidos','t.dni']:['t.nombres','t.apellidos','t.dni','t.codigo'];}
        if($q&&in_array($resource,['estudiantes','profesores','apoderados','visitas'],true)){$where[]='('.implode(' OR ',array_map(fn($f)=>"$f LIKE ?",$search)).')';foreach($search as $s)$params[]='%'.$q.'%';}
        foreach(['grado','seccion','estado','id_estudiante','id_visita'] as $f)if(isset($_GET[$f])&&$_GET[$f]!==''&&isset(schema()[$resource]['fields'][$f])){$where[]="t.`$f`=?";$params[]=$_GET[$f];}
        foreach(['desde'=>'>=','hasta'=>'<='] as $key=>$op)if($resource==='visitas'&&!empty($_GET[$key])){$where[]="t.fecha_visita $op ?";$params[]=$_GET[$key];}
        $w=$where?' WHERE '.implode(' AND ',$where):'';
        $total=(int)query("SELECT COUNT(*) FROM $from $w",$params)->fetchColumn();
        $limit=min(200,max(1,(int)($_GET['limit']??20)));$page=max(1,(int)($_GET['page']??1));$offset=($page-1)*$limit;
        $order=$resource==='visitas'?'t.fecha_visita DESC,t.id_visita DESC':"t.`$pk` DESC";
        reply(['items'=>query("SELECT $select FROM $from $w ORDER BY $order LIMIT $limit OFFSET $offset",$params)->fetchAll(),'total'=>$total,'page'=>$page,'limit'=>$limit]);
    }
    if(in_array($resource,['salud','vivienda','area_espiritual'],true))fail('Edita estas secciones dentro de la ficha de visita.',405);
    if($method==='DELETE') {if(!$id)fail('Falta el identificador.');row($resource,$id);$pk=schema()[$resource]['pk'];query("DELETE FROM `$resource` WHERE `$pk`=?",[$id]);reply(true);}
    if(($method==='PUT'&&!$id)||($method==='POST'&&$id))fail('Método e identificador incompatibles.',400);
    db()->beginTransaction();
    if($resource!=='visitas') {$data=validate($resource,$input);$saved=save($resource,$data,$id);}
    else {
        foreach(['visita','salud','vivienda','area_espiritual'] as $section)if(!isset($input[$section])||!is_array($input[$section]))fail('Falta la sección '.$section.'.');
        $v=validate('visitas',$input['visita']);
        $student=row('estudiantes',(int)$v['id_estudiante'],true);$prof=row('profesores',(int)$v['id_profesor']);
        if(!$prof['estado']&&(!$id||row('visitas',$id)['id_profesor']!=$v['id_profesor']))fail('Selecciona un profesor activo.');
        if($id&&row('visitas',$id)['id_estudiante']!=$v['id_estudiante'])fail('No se puede cambiar el estudiante de una ficha existente.');
        // Snapshot on creation: future directory edits do not rewrite the historical family data.
        if(!$id)$v['ficha_snapshot']=json_encode(['estudiante'=>$student,'apoderados'=>query('SELECT * FROM apoderados WHERE id_estudiante=?',[$v['id_estudiante']])->fetchAll()],JSON_UNESCAPED_UNICODE);
        $saved=save('visitas',$v,$id);
        foreach(['salud','vivienda'] as $t){$data=validate($t,array_merge($input[$t],['id_visita'=>$saved]));$pk=schema()[$t]['pk'];$existing=query("SELECT `$pk` FROM `$t` WHERE id_visita=?",[$saved])->fetchColumn();save($t,$data,$existing?(int)$existing:null);}
        $people=[];if(count($input['area_espiritual'])>3)fail('Solo se permiten padre, madre e hijo.');
        foreach($input['area_espiritual'] as $a){if(!is_array($a))fail('Área espiritual no válida.');$d=validate('area_espiritual',array_merge($a,['id_visita'=>$saved]));if(in_array($d['persona'],$people,true))fail('Persona repetida en el área espiritual.');$people[]=$d['persona'];}
        query('DELETE FROM area_espiritual WHERE id_visita=?',[$saved]);
        foreach($input['area_espiritual'] as $a)save('area_espiritual',validate('area_espiritual',array_merge($a,['id_visita'=>$saved])));
    }
    db()->commit();reply(['id'=>$saved],$method==='POST'?201:200);
} catch(ApiError $e) {
    if(isset($resource)&&$method!=='GET'){try{if(db()->inTransaction())db()->rollBack();}catch(Throwable $ignored){}}
    http_response_code($e->getCode());echo json_encode(['error'=>$e->getMessage(),'fields'=>$e->fields],JSON_UNESCAPED_UNICODE);
} catch(Throwable $e) {
    try{if(db()->inTransaction())db()->rollBack();}catch(Throwable $ignored){}
    $status=500;$message='No se pudo completar la operación. Verifica MySQL, la conexión y la migración indicada en el README.';
    if($e instanceof PDOException&&($e->errorInfo[1]??0)===1062){$status=409;$message='Ya existe un registro con ese DNI o identificador único.';}
    if($e instanceof PDOException&&in_array($e->errorInfo[1]??0,[1451,1452])){$status=409;$message='El registro está relacionado con otros datos. Comprueba el estudiante y profesor; no se pueden eliminar si tienen visitas.';}
    error_log($e->getMessage());http_response_code($status);echo json_encode(['error'=>$message],JSON_UNESCAPED_UNICODE);
}
