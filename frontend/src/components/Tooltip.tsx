import type { ReactNode } from 'react'

interface TooltipProps {
  texto: string
  children: ReactNode
  // El tooltip puede pintarse en distinto color según la gravedad del aviso
  variante?: 'rojo' | 'naranja'
}

// Componente reutilizable de tooltip personalizado, sin depender del
// atributo "title" nativo del navegador (que es pequeño, gris, y con
// retraso). Usa el patrón "group" de Tailwind: al aplicar la clase
// "group" al contenedor padre, cualquier hijo con "group-hover:algo"
// reacciona cuando el MOUSE PASA SOBRE EL PADRE, no solo sobre sí mismo.
// Esto evita tener que manejar estado de React (useState) solo para un hover.
function Tooltip({ texto, children, variante = 'rojo' }: TooltipProps) {
  const colorFondo = variante === 'rojo' ? 'bg-red-600' : 'bg-orange-500'

  return (
    <span className="group relative inline-block cursor-help">
      {children}

      {/* El tooltip en sí: invisible y transparente por defecto.
          "group-hover:opacity-100" lo hace aparecer cuando el mouse
          está sobre el <span> padre (el que tiene la clase "group").
          "pointer-events-none" evita que el tooltip "robe" el hover
          del mouse, lo cual causaría parpadeos raros */}
      <span
        className={`absolute left-1/2 -translate-x-1/2 bottom-full mb-2 whitespace-nowrap
          ${colorFondo} text-white text-xs px-2 py-1 rounded
          opacity-0 group-hover:opacity-100 transition-opacity duration-150
          pointer-events-none z-10`}
      >
        {texto}
        {/* Pequeño triángulo decorativo apuntando hacia el texto,
            hecho con bordes de CSS en vez de una imagen */}
        <span
          className={`absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent
            ${variante === 'rojo' ? 'border-t-red-600' : 'border-t-orange-500'}`}
        />
      </span>
    </span>
  )
}

export default Tooltip