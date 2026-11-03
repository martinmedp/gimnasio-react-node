// Deja una base de datos recién creada lista para usar: roles, catálogos
// básicos y el primer Administrador. Es IDEMPOTENTE: se puede ejecutar
// todas las veces que se quiera, porque nunca duplica ni sobrescribe lo
// que ya existe.
//
// Uso (desde la carpeta backend):  npm run db:seed

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const ROLES = ['Administrador', 'Recepcionista', 'Entrenador', 'Cliente'];

// Catálogos iniciales. Se crean SOLO si la tabla está vacía, para no
// meter duplicados en una base que ya tiene los suyos con otros nombres
const SECCIONES_CUERPO = ['Pecho', 'Espalda', 'Hombros', 'Bíceps', 'Tríceps', 'Piernas', 'Glúteos', 'Abdomen', 'Cardio'];
const CATEGORIAS_GASTO = ['Mantenimiento', 'Servicios públicos', 'Insumos', 'Nómina', 'Otros'];

async function crearRoles() {
  for (const nombre of ROLES) {
    const existente = await prisma.rol.findUnique({ where: { nombre } });
    if (existente) {
      console.log(`Rol "${nombre}": ya existe`);
      continue;
    }
    await prisma.rol.create({ data: { nombre } });
    console.log(`Rol "${nombre}": creado`);
  }
}

async function crearCatalogos() {
  if ((await prisma.seccionCuerpo.count()) === 0) {
    await prisma.seccionCuerpo.createMany({ data: SECCIONES_CUERPO.map((nombre) => ({ nombre })) });
    console.log(`Secciones del cuerpo: creadas (${SECCIONES_CUERPO.length})`);
  } else {
    console.log('Secciones del cuerpo: ya hay registros, no se toca nada');
  }

  if ((await prisma.categoriaGasto.count()) === 0) {
    await prisma.categoriaGasto.createMany({ data: CATEGORIAS_GASTO.map((nombre) => ({ nombre })) });
    console.log(`Categorías de gasto: creadas (${CATEGORIAS_GASTO.length})`);
  } else {
    console.log('Categorías de gasto: ya hay registros, no se toca nada');
  }
}

async function crearAdministrador() {
  const email = process.env.ADMIN_EMAIL?.trim();
  const password = process.env.ADMIN_PASSWORD;
  const nombre = process.env.ADMIN_NOMBRE?.trim() || 'Administrador';

  // Sin estas variables no se crea ningún usuario: la contraseña nunca va
  // escrita en el código, solo en el .env (que no se sube a git)
  if (!email || !password) {
    console.log('Administrador: se omite (define ADMIN_EMAIL y ADMIN_PASSWORD en el .env para crearlo)');
    return;
  }

  // Las mismas reglas que exige el sistema para toda contraseña nueva
  if (!/^\S+@\S+\.\S+$/.test(email)) {
    throw new Error('ADMIN_EMAIL no tiene formato de correo');
  }
  if (password.length < 8 || password.length > 72) {
    throw new Error('ADMIN_PASSWORD debe tener entre 8 y 72 caracteres');
  }

  // Si ya existe un usuario con ese correo NO se toca (ni su contraseña):
  // el seed no es una forma de restablecer claves
  const existente = await prisma.usuario.findUnique({ where: { email } });
  if (existente) {
    console.log(`Administrador: ya existe un usuario con el correo ${email}; no se modifica`);
    return;
  }

  const rol = await prisma.rol.findUnique({ where: { nombre: 'Administrador' } });
  if (!rol) {
    throw new Error('No existe el rol Administrador (los roles se crean antes, en este mismo script)');
  }

  // Se guarda el hash, igual que en el resto de la aplicación
  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.usuario.create({
    data: { nombre, email, password: passwordHash, rolId: rol.id, activo: true },
  });
  console.log(`Administrador: creado (${email})`);
}

async function main() {
  // Muestra contra qué base se va a trabajar, para no equivocarse de destino
  try {
    const base = new URL(process.env.DATABASE_URL ?? '').pathname.replace(/^\//, '');
    console.log(`Base de datos: ${base}`);
  } catch {
    throw new Error('DATABASE_URL no está definida o no tiene un formato válido');
  }

  await crearRoles();
  await crearCatalogos();
  await crearAdministrador();
}

main()
  .catch((error) => {
    console.error('Error en el seed:', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });