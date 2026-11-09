import type { ItemCosts, ProtocolItem } from '../types'

export const itemTotal = (c: ItemCosts) => c.product + c.pickup + c.shipping + c.postal

/** O item só conta como classificado quando o SAC definiu modo de falha, área e tratativa. */
export const isClassified = (i: ProtocolItem) => !!(i.failureMode && i.responsibleArea && i.treatment)

export const COST_LABEL: Record<keyof ItemCosts, string> = {
  product: 'Produto',
  shipping: 'Transportadora (envio)',
  pickup: 'Devolução (coleta)',
  postal: 'Correios',
}
