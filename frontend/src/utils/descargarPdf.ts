import api from '../api'

// Pide un PDF protegido al backend (con el token, vía la instancia de
// Axios que ya tienes configurada) y lo abre en una pestaña nueva.
//
// responseType: 'blob' le dice a Axios "no proceses esto como JSON, dámelo
// como datos binarios crudos" — un PDF no es texto, así que JSON.parse()
// fallaría si Axios intentara interpretarlo como siempre hace por defecto.
//
// URL.createObjectURL crea una URL temporal, válida solo en este navegador
// y mientras la pestaña esté abierta, que apunta a esos datos binarios en
// memoria — es la forma estándar de mostrar un archivo que llegó por
// fetch/Axios, en vez de un archivo que ya vivía en una URL real del servidor
export async function abrirPdf(url: string, params?: Record<string, string>) {
  const response = await api.get(url, { params, responseType: 'blob' })
  const blobUrl = URL.createObjectURL(response.data)
  window.open(blobUrl, '_blank')
}