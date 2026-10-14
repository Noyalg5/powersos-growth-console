import { Link } from 'react-router'
import { PageHeader } from '@/components/PageHeader'
import { overview } from '@/nav'

export default function NotFound() {
  return (
    <PageHeader eyebrow="404" title="Page not found" lead="That address isn't part of the console.">
      <Link
        to={overview.path}
        className="mt-8 inline-flex rounded-md bg-accent px-4 py-2 text-sm font-medium text-on-accent hover:opacity-90"
      >
        Back to the overview
      </Link>
    </PageHeader>
  )
}
