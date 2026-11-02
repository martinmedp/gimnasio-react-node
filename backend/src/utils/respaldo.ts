import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import archiver from 'archiver';
import type { Respaldo } from '@prisma/client';
import prisma from '../prisma';

const execFileAsync = promisify(execFile);

// Los respaldos se guardan en backend/respaldos (src/utils -> ../../respaldos).
// Esta carpeta NO se sirve públicamente y está excluida de git: contiene
// todos los datos personales de los clientes
export const CARPETA_RESPALDOS = path.join(__dirname, '../../respaldos');
const CARPETA_UPLOADS = path.join(__dirname, '../../uploads');

// Cuántos respaldos buenos se conservan; los más antiguos se eliminan
const RESPALDOS_A_CONSERVAR = 14;

// Para impedir dos respaldos a la vez (un doble clic, o el reloj justo
// cuando alguien pulsa el botón)
let respaldoEnCurso = false;

export function hayRespaldoEnCurso(): boolean {
  return respaldoEnCurso;
}

// Error específico para "ya hay uno corriendo", para que la ruta responda 409
export class RespaldoEnCursoError extends Error { }

// Dónde está mysqldump. Se puede fijar con MYSQLDUMP_PATH en el .env; si no,
// se usa la ruta de XAMPP en Windows o el comando del sistema en otros
function rutaMysqldump(): string {
  if (process.env.MYSQLDUMP_PATH) return process.env.MYSQLDUMP_PATH;
  return process.platform === 'win32' ? 'C:\\xampp\\mysql\\bin\\mysqldump.exe' : 'mysqldump';
}

// Saca servidor, puerto, usuario, contraseña y nombre de la base de la
// DATABASE_URL del .env (mysql://usuario:clave@servidor:puerto/base), para
// no repetirlos en otra variable
function datosDeConexion() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('Falta la variable DATABASE_URL en el .env');

  const direccion = new URL(url);
  return {
    host: direccion.hostname,
    puerto: direccion.port || '3306',
    usuario: decodeURIComponent(direccion.username),
    clave: decodeURIComponent(direccion.password),
    base: decodeURIComponent(direccion.pathname.replace(/^\//, '')),
  };
}

// "20261029-203015": fecha y hora local, con segundos para que dos
// respaldos manuales seguidos no se pisen el nombre
function marcaDeTiempo(fecha: Date = new Date()): string {
  const dos = (numero: number) => String(numero).padStart(2, '0');
  return (
    `${fecha.getFullYear()}${dos(fecha.getMonth() + 1)}${dos(fecha.getDate())}-` +
    `${dos(fecha.getHours())}${dos(fecha.getMinutes())}${dos(fecha.getSeconds())}`
  );
}

// Ejecuta mysqldump y deja el volcado en destinoSql.
// execFile (y no exec) NO pasa por una consola: los argumentos van como
// lista, así que nada de lo que contengan puede interpretarse como un comando.
// La contraseña viaja en MYSQL_PWD, no en la línea de comandos, donde otros
// programas podrían verla
async function volcarBase(destinoSql: string): Promise<void> {
  const conexion = datosDeConexion();

  const argumentos = [
    `--host=${conexion.host}`,
    `--port=${conexion.puerto}`,
    '--protocol=TCP',
    `--user=${conexion.usuario}`,
    '--single-transaction', // copia consistente sin bloquear la base
    '--routines',
    '--triggers',
    '--default-character-set=utf8mb4',
    // mysqldump escribe el archivo él mismo (así no depende de la codificación de la consola)
    `--result-file=${destinoSql}`,
    conexion.base,
  ];

  try {
    await execFileAsync(rutaMysqldump(), argumentos, {
      env: { ...process.env, MYSQL_PWD: conexion.clave },
      windowsHide: true,
      timeout: 5 * 60 * 1000,
    });
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      throw new Error(`No se encontró mysqldump en "${rutaMysqldump()}". Define MYSQLDUMP_PATH en el archivo .env`);
    }
    throw new Error(`mysqldump falló: ${error.stderr || error.message}`);
  }
}

// Un volcado completo termina con la línea "-- Dump completed". Si no la
// tiene, el archivo quedó a medias y no sirve como respaldo
async function volcadoCompleto(ruta: string): Promise<boolean> {
  const archivo = await fs.promises.open(ruta, 'r');
  try {
    const { size } = await archivo.stat();
    const largo = Math.min(size, 1024);
    const buffer = Buffer.alloc(largo);
    await archivo.read(buffer, 0, largo, size - largo);
    return buffer.toString('utf8').includes('Dump completed');
  } finally {
    await archivo.close();
  }
}

// Crea el .zip con el volcado y, si existe, la carpeta de imágenes
function comprimir(archivoSql: string, nombreSql: string, destinoZip: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const salida = fs.createWriteStream(destinoZip);
    const zip = archiver('zip', { zlib: { level: 6 } });

    // "close" del archivo de salida = ya se escribió todo en el disco
    salida.on('close', () => resolve());
    salida.on('error', reject);
    zip.on('error', reject);

    zip.pipe(salida);
    zip.file(archivoSql, { name: nombreSql });
    if (fs.existsSync(CARPETA_UPLOADS)) {
      zip.directory(CARPETA_UPLOADS, 'uploads');
    }
    zip.finalize().catch(reject);
  });
}

// Borra los archivos de los respaldos buenos que superen el límite. El
// registro del historial se conserva, pero con el archivo en null
async function aplicarRotacion(): Promise<void> {
  const buenos = await prisma.respaldo.findMany({
    where: { estado: 'ok', archivo: { not: null } },
    orderBy: { creadoEn: 'desc' },
  });

  for (const viejo of buenos.slice(RESPALDOS_A_CONSERVAR)) {
    if (viejo.archivo) {
      await fs.promises.rm(path.join(CARPETA_RESPALDOS, path.basename(viejo.archivo)), { force: true });
    }
    await prisma.respaldo.update({ where: { id: viejo.id }, data: { archivo: null } });
  }
}

interface ResultadoRespaldo {
  ok: boolean;
  mensaje: string | null;
  registro: Respaldo | null;
}

// Hace un respaldo completo y registra el resultado en el historial,
// sea bueno o fallido. Solo lanza RespaldoEnCursoError si ya hay otro
// corriendo; cualquier otro problema vuelve en el resultado (ok: false)
export async function ejecutarRespaldo(
  origen: 'manual' | 'programado',
  creadoPorId: number | null
): Promise<ResultadoRespaldo> {
  if (respaldoEnCurso) {
    throw new RespaldoEnCursoError('Ya hay un respaldo en curso');
  }
  respaldoEnCurso = true;

  const marca = marcaDeTiempo();
  const nombreZip = `respaldo-${marca}.zip`;
  let rutaSql = '';
  let rutaZip = '';

  try {
    await fs.promises.mkdir(CARPETA_RESPALDOS, { recursive: true });

    const nombreSql = `${datosDeConexion().base}-${marca}.sql`;
    rutaSql = path.join(CARPETA_RESPALDOS, nombreSql);
    rutaZip = path.join(CARPETA_RESPALDOS, nombreZip);

    await volcarBase(rutaSql);

    if (!(await volcadoCompleto(rutaSql))) {
      throw new Error('El volcado de la base parece incompleto (no termina con "Dump completed")');
    }

    await comprimir(rutaSql, nombreSql, rutaZip);
    await fs.promises.rm(rutaSql, { force: true });

    const { size } = await fs.promises.stat(rutaZip);
    const registro = await prisma.respaldo.create({
      data: { origen, estado: 'ok', archivo: nombreZip, tamanoBytes: size, creadoPorId },
    });

    // Un fallo al limpiar respaldos viejos no debe invalidar el que acaba de salir bien
    try {
      await aplicarRotacion();
    } catch (error) {
      console.error('[respaldos] No se pudo aplicar la rotación:', error);
    }

    return { ok: true, mensaje: null, registro };
  } catch (error: any) {
    // Si falló a medias, no se deja ningún archivo parcial
    if (rutaSql) await fs.promises.rm(rutaSql, { force: true }).catch(() => { });
    if (rutaZip) await fs.promises.rm(rutaZip, { force: true }).catch(() => { });

    const mensaje = String(error?.message ?? error).slice(0, 2000);
    console.error('[respaldos] Falló el respaldo:', mensaje);

    // Se intenta registrar el fallo; si la base misma está caída, no se puede
    const registro = await prisma.respaldo
      .create({ data: { origen, estado: 'error', mensaje, creadoPorId } })
      .catch(() => null);

    return { ok: false, mensaje, registro };
  } finally {
    respaldoEnCurso = false;
  }
}