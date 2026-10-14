import { PagePlaceholder } from '@/components/PagePlaceholder'
import { getSection } from '@/nav'

export default function MarketStrategy() {
  return <PagePlaceholder section={getSection('market')} />
}
