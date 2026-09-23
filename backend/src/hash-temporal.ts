import bcrypt from 'bcrypt';

async function generarHash() {
  const passwordPlano = 'admin123'; // cámbiala por la que quieras usar
  const hash = await bcrypt.hash(passwordPlano, 10);
  console.log('Hash generado:', hash);
}

generarHash();