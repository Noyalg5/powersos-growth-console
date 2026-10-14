import { PagePlaceholder } from '@/components/PagePlaceholder'
import { getSection } from '@/nav'

export default function Onboarding() {
  return <PagePlaceholder section={getSection('onboarding')} />
}
