import { isAxiosError } from 'axios'

// Saca el mensaje de error que mandó el backend (el campo "error" de su
// respuesta, por ejemplo "No tienes permiso..." o "Indica ambas fechas...").
// Si el fallo no vino del backend (sin conexión, por ejemplo) o no trae
// mensaje, usa el texto por defecto que se le indique.
export function mensajeDeError(error: unknown, porDefecto: string): string {
  if (isAxiosError(error)) {
    const mensaje = error.response?.data?.error
    if (typeof mensaje === 'string') return mensaje
  }
  return porDefecto
}