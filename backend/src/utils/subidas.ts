import multer from 'multer';
import path from 'path';
import crypto from 'crypto';

// Error propio para los rechazos de archivos: así index.ts puede
// distinguirlo de cualquier otro error y responder con un mensaje claro
export class ErrorDeSubida extends Error { }

// Tipos de imagen aceptados y la extensión que se le pondrá a cada uno
const TIPOS_PERMITIDOS: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
};

const TAMANO_MAXIMO_MB = 5;

// Crea un "subidor" de imágenes de Multer para una carpeta de uploads.
// Reemplaza la configuración que se repetía en cada ruta, y agrega
// validación de tipo y de tamaño.
export function crearSubidaDeImagenes(carpeta: 'clientes' | 'ejercicios') {
  const storage = multer.diskStorage({
    // __dirname es backend/src/utils, así que ../../uploads es backend/uploads
    destination: (req, file, cb) => {
      cb(null, path.join(__dirname, '../../uploads', carpeta));
    },
    // El nombre NO usa el original que manda el usuario: es la hora más
    // 12 caracteres aleatorios, con la extensión según el tipo ya validado
    filename: (req, file, cb) => {
      const extension = TIPOS_PERMITIDOS[file.mimetype];
      cb(null, `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${extension}`);
    },
  });

  return multer({
    storage,
    limits: { fileSize: TAMANO_MAXIMO_MB * 1024 * 1024, files: 1 },
    // Se ejecuta antes de guardar nada: si el tipo no está en la lista,
    // se rechaza el archivo y no llega a escribirse en el disco
    fileFilter: (req, file, cb) => {
      if (!TIPOS_PERMITIDOS[file.mimetype]) {
        return cb(new ErrorDeSubida('Solo se permiten imágenes JPG, PNG, WEBP o GIF'));
      }
      cb(null, true);
    },
  });
}