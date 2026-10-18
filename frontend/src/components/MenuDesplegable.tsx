import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'

interface ItemMenu {
  to: string
  texto: string
}

interface MenuDesplegableProps {
  titulo: string
  items: ItemMenu[]
}

// Menú desplegable para la barra de navegación. Se abre con clic (no con
// hover) para que funcione igual en pantalla táctil, y se cierra al hacer
// clic fuera, al presionar Escape o al elegir una opción.
function MenuDesplegable({ titulo, items }: MenuDesplegableProps) {
  const [abierto, setAbierto] = useState(false)

  // Referencia al contenedor, para saber si un clic ocurrió dentro o fuera
  const contenedorRef = useRef<HTMLDivElement>(null)

  // La ruta actual, para resaltar la opción (y el grupo) donde estás parado
  const { pathname } = useLocation()

  // Una opción está activa si estás en su ruta o en una ruta hija
  // (por ejemplo, /clientes/3/medidas cuenta como parte de "Clientes")
  const estaActivo = (to: string) => pathname === to || pathname.startsWith(`${to}/`)
  const grupoActivo = items.some((item) => estaActivo(item.to))

  // Los listeners de cierre solo existen mientras el menú está abierto.
  // La función que devuelve el efecto los quita al cerrarse (o al
  // desmontarse el componente), para no dejar listeners colgados
  useEffect(() => {
    if (!abierto) return

    const cerrarSiClicFuera = (e: MouseEvent) => {
      if (contenedorRef.current && !contenedorRef.current.contains(e.target as Node)) {
        setAbierto(false)
      }
    }
    const cerrarConEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAbierto(false)
    }

    document.addEventListener('mousedown', cerrarSiClicFuera)
    document.addEventListener('keydown', cerrarConEscape)

    return () => {
      document.removeEventListener('mousedown', cerrarSiClicFuera)
      document.removeEventListener('keydown', cerrarConEscape)
    }
  }, [abierto])

  return (
    // "relative" hace que el panel desplegable (absolute) se posicione
    // respecto a este contenedor y no respecto a toda la página
    <div ref={contenedorRef} className="relative">
      <button
        type="button"
        onClick={() => setAbierto(!abierto)}
        aria-haspopup="true"
        aria-expanded={abierto}
        className={`flex items-center gap-1 ${grupoActivo ? 'text-white font-bold' : 'text-slate-300 hover:text-white'
          }`}
      >
        {titulo}
        <span className="text-xs">{abierto ? '▲' : '▼'}</span>
      </button>

      {abierto && (
        // z-40: por encima del contenido de la página, pero por debajo de
        // los modales (z-50) y de las notificaciones (z-100)
        <div className="absolute left-0 top-full mt-2 min-w-\[12rem\] bg-slate-800 border border-slate-700 rounded shadow-lg py-1 z-40">
          {items.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              onClick={() => setAbierto(false)}
              className={`block px-4 py-2 text-sm hover:bg-slate-700 ${estaActivo(item.to) ? 'text-white font-bold' : 'text-slate-300'
                }`}
            >
              {item.texto}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

export default MenuDesplegable