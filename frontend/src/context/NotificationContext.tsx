import { createContext, useContext, useState, useCallback, useRef } from 'react'
import type { ReactNode } from 'react'

type TipoToast = 'exito' | 'error' | 'info'

interface Toast {
  id: number
  mensaje: string
  tipo: TipoToast
}

interface OpcionesConfirmar {
  titulo?: string
  textoAceptar?: string
  textoCancelar?: string
  // "peligro" pinta el botón de Aceptar en rojo, para acciones destructivas
  // (eliminar, desactivar) — igual que ya diferenciabas visualmente antes
  variante?: 'normal' | 'peligro'
}

interface Confirmacion extends OpcionesConfirmar {
  mensaje: string
  resolver: (respuesta: boolean) => void
}

interface NotificationContextType {
  notificar: (mensaje: string, tipo?: TipoToast) => void
  confirmar: (mensaje: string, opciones?: OpcionesConfirmar) => Promise<boolean>
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined)

// Colores de fondo según el tipo de notificación
const COLOR_TOAST: Record<TipoToast, string> = {
  exito: 'bg-green-600',
  error: 'bg-red-600',
  info: 'bg-slate-700',
}

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const [confirmacion, setConfirmacion] = useState<Confirmacion | null>(null)

  // useRef para el contador de ids: no necesitamos que cambiarlo provoque
  // un re-render (a diferencia de useState), solo queremos un número
  // que suba cada vez, sin repetirse
  const siguienteId = useRef(0)

  const notificar = useCallback((mensaje: string, tipo: TipoToast = 'info') => {
    const id = siguienteId.current++
    setToasts((actuales) => [...actuales, { id, mensaje, tipo }])

    // Cada toast se quita solo después de 4 segundos, filtrando por su id
    setTimeout(() => {
      setToasts((actuales) => actuales.filter((t) => t.id !== id))
    }, 4000)
  }, [])

  const cerrarToast = (id: number) => {
    setToasts((actuales) => actuales.filter((t) => t.id !== id))
  }

  // confirmar devuelve una Promise que queda "pendiente" hasta que el
  // usuario hace clic en Aceptar o Cancelar. Guardamos la función
  // "resolver" (la que resuelve esa Promise) dentro del estado, para
  // poder llamarla después, desde los botones del modal
  const confirmar = useCallback((mensaje: string, opciones: OpcionesConfirmar = {}) => {
    return new Promise<boolean>((resolver) => {
      setConfirmacion({ mensaje, ...opciones, resolver })
    })
  }, [])

  const responderConfirmacion = (respuesta: boolean) => {
    confirmacion?.resolver(respuesta)
    setConfirmacion(null)
  }

  return (
    <NotificationContext.Provider value={{ notificar, confirmar }}>
      {children}

      {/* Contenedor de toasts: fijo en la esquina superior derecha,
          apilados de arriba hacia abajo a medida que se agregan */}
      <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 max-w-sm">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            onClick={() => cerrarToast(toast.id)}
            className={`${COLOR_TOAST[toast.tipo]} text-white px-4 py-3 rounded shadow-lg cursor-pointer text-sm`}
          >
            {toast.mensaje}
          </div>
        ))}
      </div>

      {/* Modal de confirmación: mismo patrón de overlay que ya usas en
          el resto de la app (fondo oscuro + tarjeta centrada) */}
      {confirmacion && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[110] p-4">
          <div className="bg-slate-800 rounded p-6 w-full max-w-sm">
            {confirmacion.titulo && (
              <h2 className="text-white font-bold text-lg mb-2">{confirmacion.titulo}</h2>
            )}
            <p className="text-slate-200 mb-5 whitespace-pre-wrap">{confirmacion.mensaje}</p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => responderConfirmacion(false)}
                className="bg-slate-600 text-white px-4 py-2 rounded hover:bg-slate-700"
              >
                {confirmacion.textoCancelar ?? 'Cancelar'}
              </button>
              <button
                onClick={() => responderConfirmacion(true)}
                className={`px-4 py-2 rounded text-white ${confirmacion.variante === 'peligro'
                    ? 'bg-red-600 hover:bg-red-700'
                    : 'bg-blue-600 hover:bg-blue-700'
                  }`}
              >
                {confirmacion.textoAceptar ?? 'Aceptar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </NotificationContext.Provider>
  )
}

export function useNotification() {
  const context = useContext(NotificationContext)
  if (!context) {
    throw new Error('useNotification debe usarse dentro de un NotificationProvider')
  }
  return context
}