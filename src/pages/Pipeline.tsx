import { PagePlaceholder } from '@/components/PagePlaceholder'
import { getSection } from '@/nav'

export default function Pipeline() {
  return <PagePlaceholder section={getSection('pipeline')} />
}
