<?php
declare(strict_types=1);
date_default_timezone_set('America/Lima');
function db(): PDO {
    static $pdo;
    if (!$pdo) {
        $c = require __DIR__.'/config.php';
        $pdo = new PDO("mysql:host={$c['host']};port={$c['port']};dbname={$c['database']};charset=utf8mb4", $c['user'], $c['password'], [PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC, PDO::ATTR_EMULATE_PREPARES=>false]);
    }
    return $pdo;
}
function query(string $sql, array $values=[]): PDOStatement {
    $s=db()->prepare($sql); $s->execute($values); return $s;
}
function schema(): array { static $s; return $s ??= json_decode(file_get_contents(__DIR__.'/schema.json'),true,512,JSON_THROW_ON_ERROR); }
function fail(string $message,int $status=422,array $fields=[]): void { throw new ApiError($message,$status,$fields); }
class ApiError extends RuntimeException { public array $fields; public function __construct(string $m,int $s,array $f=[]) {parent::__construct($m,$s);$this->fields=$f;} }
function reply($data,int $status=200): void {http_response_code($status);echo json_encode(['data'=>$data],JSON_UNESCAPED_UNICODE|JSON_INVALID_UTF8_SUBSTITUTE);exit;}
function row(string $table,int $id,bool $lock=false): array {
    $pk=schema()[$table]['pk'];
    $r=query("SELECT * FROM `$table` WHERE `$pk`=?".($lock?' FOR UPDATE':''),[$id])->fetch();
    if (!$r) fail('El registro ya no existe.',404);return $r;
}
/** Complete record validation against an explicit, versioned allowlist. */
function validate(string $table,array $input): array {
    $out=[];$errors=[];
    foreach(schema()[$table]['fields'] as $name=>$f) {
        $v=array_key_exists($name,$input)?$input[$name]:($f['default']??null);
        if (is_array($v)||is_object($v)) {$errors[$name]='Valor no válido.';continue;}
        if (is_string($v)) $v=trim($v);
        if ($v==='') $v=null;
        if ($v===null) {if($f['required'])$errors[$name]='Este campo es obligatorio.';$out[$name]=$v;continue;}
        $type=$f['type'];
        if ($type==='boolean') {if(!in_array($v,[0,1,'0','1',true,false],true))$errors[$name]='Seleccione Sí o No.';else $v=(int)$v;}
        elseif($type==='number') {
            if(!is_numeric($v)||!is_finite((float)$v)||(float)$v<$f['min']||(float)$v>$f['max']||($f['step']==='1'&&(float)$v!=floor((float)$v)))$errors[$name]='Número fuera del rango permitido.';
            else $v=$f['step']==='1'?(int)$v:round((float)$v,2);
        } elseif($type==='select'&&!in_array($v,$f['options'],true))$errors[$name]='Seleccione una opción válida.';
        elseif($type==='email'&&!filter_var($v,FILTER_VALIDATE_EMAIL))$errors[$name]='Correo electrónico no válido.';
        elseif($type==='date') { $d=DateTimeImmutable::createFromFormat('!Y-m-d',(string)$v);if(!$d||$d->format('Y-m-d')!==$v||$v<'1900-01-01'||($name==='fecha_nacimiento'&&$v>date('Y-m-d')))$errors[$name]='Fecha no válida.'; }
        elseif($type==='time'&&!preg_match('/^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/',(string)$v))$errors[$name]='Hora no válida.';
        if(isset($f['max'])&&$type!=='number'&&mb_strlen((string)$v)>$f['max'])$errors[$name]='Texto demasiado largo.';
        if(isset($f['pattern'])&&!preg_match('/^'.$f['pattern'].'$/D',(string)$v))$errors[$name]='El DNI debe tener 8 dígitos.';
        $out[$name]=$v;
    }
    if($table==='apoderados') {
        if(($out['colaborador_acjg']??null)===1) {foreach(['ingreso_trabajo','otros_ingresos','total_ingresos'] as $f)$out[$f]=null;}
        else { $out['total_ingresos']=round(($out['ingreso_trabajo']??0)+($out['otros_ingresos']??0),2); if($out['total_ingresos']>99999999.99)$errors['otros_ingresos']='La suma de ingresos excede el rango permitido.'; }
    }
    if($table==='visitas'&&($out['estado']??'')==='Realizada'&&($out['fecha_visita']??'')>date('Y-m-d'))$errors['fecha_visita']='Una visita realizada no puede tener fecha futura.';
    if($errors)fail('Revisa los campos indicados.',422,$errors);
    return $out;
}
function save(string $table,array $data,?int $id=null): int {
    $pk=schema()[$table]['pk'];$keys=array_keys($data);
    if($id) {row($table,$id);query("UPDATE `$table` SET ".implode(',',array_map(fn($k)=>"`$k`=?",$keys))." WHERE `$pk`=?",[...array_values($data),$id]);return $id;}
    query("INSERT INTO `$table` (`".implode('`,`',$keys)."`) VALUES (".implode(',',array_fill(0,count($keys),'?')).")",array_values($data));return (int)db()->lastInsertId();
}
function visitDetail(int $id): array {
    $v=row('visitas',$id);
    $snapshot=$v['ficha_snapshot']?json_decode($v['ficha_snapshot'],true):null;
    unset($v['ficha_snapshot']);
    return ['visita'=>$v,'estudiante'=>$snapshot['estudiante']??row('estudiantes',(int)$v['id_estudiante']), 'apoderados'=>$snapshot['apoderados']??query('SELECT * FROM apoderados WHERE id_estudiante=?',[$v['id_estudiante']])->fetchAll(),'profesor'=>row('profesores',(int)$v['id_profesor']), 'salud'=>query('SELECT * FROM salud WHERE id_visita=?',[$id])->fetch()?:[], 'vivienda'=>query('SELECT * FROM vivienda WHERE id_visita=?',[$id])->fetch()?:[], 'area_espiritual'=>query('SELECT * FROM area_espiritual WHERE id_visita=? ORDER BY persona',[$id])->fetchAll()];
}
