/** The ID of a card's Move to… menu, so focus can follow a card to its new column. */
export const moveMenuId = (leadId: string) => `move-${leadId}`

/** The ID of a deal's card, so other views can scroll to it. */
export const dealCardId = (leadId: string) => `deal-${leadId}`
