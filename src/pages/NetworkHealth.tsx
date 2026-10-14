import { PagePlaceholder } from '@/components/PagePlaceholder'
import { getSection } from '@/nav'

export default function NetworkHealth() {
  return <PagePlaceholder section={getSection('network')} />
}
