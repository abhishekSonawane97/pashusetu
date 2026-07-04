// AuthContext — docs/09-backend/README.md §3.1 step 5: services receive the
// full Prisma User row via ctx; they never see the raw token.

import type { User } from '@prisma/client'

export type AuthContext = { user: User }
