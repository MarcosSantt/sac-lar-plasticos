/** Erro com status HTTP e mensagem já pronta para ser exibida ao usuário. */
export class HttpError extends Error {
  status: number
  code?: string

  constructor(status: number, message: string, code?: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

export const badRequest = (message: string) => new HttpError(400, message)
export const forbidden = (message = 'Você não tem permissão para esta ação.') => new HttpError(403, message)
export const notFound = (message = 'Registro não encontrado.') => new HttpError(404, message)
export const conflict = (message: string) => new HttpError(409, message)
