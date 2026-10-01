interface TarjetaDatoProps {
  titulo: string
  valor: string
  // Clase de Tailwind para el color del valor (por defecto, blanco)
  claseValor?: string
}

// Tarjeta pequeña para mostrar un dato destacado (un total, un conteo...)
function TarjetaDato({ titulo, valor, claseValor = 'text-white' }: TarjetaDatoProps) {
  return (
    <div className="bg-slate-800 rounded p-3">
      <p className="text-slate-400 text-xs">{titulo}</p>
      <p className={`text-lg font-bold ${claseValor}`}>{valor}</p>
    </div>
  )
}

export default TarjetaDato