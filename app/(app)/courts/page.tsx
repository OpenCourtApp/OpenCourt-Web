import { redirect } from 'next/navigation'

// Courts management moved into Settings → Courts (a principal-only section).
// Kept as a redirect so old links/bookmarks don't 404.
export default function CourtsPage() {
  redirect('/settings')
}
