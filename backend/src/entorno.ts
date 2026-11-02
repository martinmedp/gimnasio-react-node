// Comprueba al arrancar que la configuración mínima esté completa. Si falta
// algo, el sistema se detiene de inmediato con un mensaje claro: es mejor
// que arrancar "a medias" y fallar después con errores difíciles de entender.

const enProduccion = process.env.NODE_ENV === 'production';

// Siempre obligatorias
const requeridas = ['DATABASE_URL', 'JWT_SECRET'];
// En producción, además, hay que indicar la dirección real del frontend
// (si no, CORS solo aceptaría la de desarrollo y nadie podría entrar)
if (enProduccion) requeridas.push('FRONTEND_URL');

const faltantes = requeridas.filter((nombre) => !process.env[nombre]);

if (faltantes.length > 0) {
  console.error(
    `Falta configuración en el archivo .env: ${faltantes.join(', ')}.\n` +
    'Copia .env.example como .env y complétalo.'
  );
  process.exit(1);
}

// La clave que firma las sesiones debe ser larga: una corta se puede adivinar
// por fuerza bruta y permitiría falsificar sesiones de cualquier usuario
const secreto = process.env.JWT_SECRET as string;
if (secreto.length < 32) {
  const mensaje =
    'JWT_SECRET es demasiado corta (mínimo 32 caracteres). Genera una con:\n' +
    "  node -e \"console.log(require('crypto').randomBytes(48).toString('hex'))\"";

  if (enProduccion) {
    console.error(mensaje);
    process.exit(1);
  }
  // En desarrollo solo se avisa, para no estorbar
  console.warn(`AVISO: ${mensaje}`);
}

// Este archivo solo se importa por su efecto; "export {}" lo marca como módulo
export { };