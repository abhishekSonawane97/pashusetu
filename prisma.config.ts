// Prisma 7 CLI configuration (docs/07-database/README.md §8, docs/09-backend/README.md §6).
// Loads .env so `pnpm prisma ...` works locally; CI/Vercel provide env vars directly.
import 'dotenv/config'
import { defineConfig } from 'prisma/config'

export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    // Migrations and introspection MUST use the direct (non-pooled) Neon URL —
    // doc 07 §8.3. The app's runtime client uses the pooled DATABASE_URL via a
    // driver adapter in lib/prisma.ts, never this URL.
    url: process.env.DIRECT_URL,
  },
})
