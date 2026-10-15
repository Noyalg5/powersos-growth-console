/** IDs that tie a tab to its panel: give the panel `id={ids.panel}` and `aria-labelledby={ids.tab}`. */
export function tabIds(group: string, id: string) {
  return { tab: `${group}-tab-${id}`, panel: `${group}-panel-${id}` }
}
