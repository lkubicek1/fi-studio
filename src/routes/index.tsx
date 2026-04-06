import { createFileRoute } from '@tanstack/react-router'
import { HomePage } from '@/components/routes/home_page'

export const Route = createFileRoute('/')({
  component: HomePage,
})
