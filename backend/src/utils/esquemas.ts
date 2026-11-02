import { z } from 'zod';

// ============ Finanzas ============

// Los únicos métodos de pago que existen. Los cierres de caja dependen de
// que el efectivo se llame exactamente "efectivo": con la lista cerrada,
// ya no puede entrar un "Efectivo", "cash" o cualquier otro texto
export const METODOS_PAGO = ['efectivo', 'tarjeta', 'transferencia'] as const;

const metodoPago = z.enum(METODOS_PAGO, {
  errorMap: () => ({ message: 'El método de pago debe ser efectivo, tarjeta o transferencia' }),
});

// Cuerpo de POST /gastos. Los formularios mandan los números como texto
// ("50000"), por eso se usa coerce: convierte a número antes de comprobar
export const esquemaGasto = z.object({
  categoriaId: z.coerce
    .number({ invalid_type_error: 'Selecciona una categoría' })
    .int('Categoría no válida')
    .positive('Selecciona una categoría'),
  descripcion: z
    .string({ required_error: 'La descripción es obligatoria', invalid_type_error: 'La descripción debe ser texto' })
    .trim()
    .min(3, 'La descripción debe tener al menos 3 caracteres')
    .max(2000, 'La descripción no puede superar los 2000 caracteres'),
  monto: z.coerce
    .number({ invalid_type_error: 'El monto es obligatorio y debe ser un número' })
    .positive('El monto debe ser mayor a 0')
    .max(1_000_000_000, 'El monto es demasiado alto'),
  metodoPago,
});

// Cuerpo de POST /membresias/:id/pagos: el monto no se manda (lo calcula
// el backend con el precio del plan), solo el método
export const esquemaPagoMembresia = z.object({ metodoPago });

// ============ Cuentas y contraseñas ============

// Regla única para toda contraseña NUEVA. El máximo de 72 existe porque
// bcrypt ignora en silencio lo que pase de 72 bytes
const contrasena = z
  .string({ required_error: 'La contraseña es obligatoria', invalid_type_error: 'La contraseña debe ser texto' })
  .min(8, 'La contraseña debe tener al menos 8 caracteres')
  .max(72, 'La contraseña no puede superar los 72 caracteres');

const correo = z
  .string({ required_error: 'El correo es obligatorio', invalid_type_error: 'El correo debe ser texto' })
  .trim()
  .email('El correo no es válido');

const nombre = z
  .string({ required_error: 'El nombre es obligatorio', invalid_type_error: 'El nombre debe ser texto' })
  .trim()
  .min(2, 'El nombre debe tener al menos 2 caracteres')
  .max(100, 'El nombre no puede superar los 100 caracteres');

// Cuerpo de POST /auth/registro-cliente (registro público)
export const esquemaRegistroCliente = z.object({
  nombre,
  documento: z
    .string({ required_error: 'El documento es obligatorio', invalid_type_error: 'El documento debe ser texto' })
    .trim()
    .min(1, 'El documento es obligatorio')
    .max(30, 'El documento es demasiado largo'),
  email: correo,
  password: contrasena,
});

// El rol llega como texto desde el <select>, por eso coerce
const rolId = z.coerce
  .number({ invalid_type_error: 'Selecciona un rol' })
  .int('Rol no válido')
  .positive('Selecciona un rol');

// Cuerpo de POST /usuarios (crear personal)
export const esquemaUsuarioNuevo = z.object({
  nombre,
  email: correo,
  password: contrasena,
  rolId,
});

// Cuerpo de PUT /usuarios/:id. Aquí la contraseña es opcional: vacía o
// ausente significa "no cambiarla"; si viene, debe cumplir la regla
export const esquemaUsuarioEdicion = z.object({
  nombre,
  email: correo,
  rolId,
  password: z
    .string()
    .optional()
    .refine((valor) => !valor || (valor.length >= 8 && valor.length <= 72), {
      message: 'La contraseña debe tener entre 8 y 72 caracteres',
    }),
});

// Cuerpo de POST /clientes/:id/cuenta (el Administrador crea la cuenta
// de acceso de un cliente existente)
export const esquemaCuentaCliente = z.object({
  email: correo,
  password: contrasena,
});

// Cuerpo de PUT /clientes/:id/cuenta/password (restablecer la clave)
export const esquemaClaveCliente = z.object({
  password: contrasena,
});