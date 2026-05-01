/**
 * wipe-data.ts
 * Deletes all application data while preserving Admin + Department records.
 * Run: cd packages/db && npx tsx prisma/wipe-data.ts
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🗑️  Wiping application data (Admin + Department rows preserved)...\n')

  // ── Delete in FK-safe order ────────────────────────────────────────────────
  const outreach = await prisma.outreachLog.deleteMany()
  console.log(`  ✓ OutreachLog   — ${outreach.count} rows deleted`)

  const events = await prisma.leadEvent.deleteMany()
  console.log(`  ✓ LeadEvent     — ${events.count} rows deleted`)

  const leads = await prisma.lead.deleteMany()
  console.log(`  ✓ Lead          — ${leads.count} rows deleted`)

  const forms = await prisma.form.deleteMany()
  console.log(`  ✓ Form          — ${forms.count} rows deleted`)

  // TeamMember before Team/User
  const teamMembers = await prisma.teamMember.deleteMany()
  console.log(`  ✓ TeamMember    — ${teamMembers.count} rows deleted`)

  const teams = await prisma.team.deleteMany()
  console.log(`  ✓ Team          — ${teams.count} rows deleted`)

  const users = await prisma.user.deleteMany()
  console.log(`  ✓ User          — ${users.count} rows deleted`)

  // ── Summary ────────────────────────────────────────────────────────────────
  const adminCount = await prisma.admin.count()
  const deptCount  = await prisma.department.count()

  console.log('\n✅  Done.')
  console.log(`\n  Preserved:`)
  console.log(`    Admin      — ${adminCount} records kept`)
  console.log(`    Department — ${deptCount} records kept`)
}

main()
  .catch(e => { console.error('❌ Error:', e); process.exit(1) })
  .finally(() => prisma.$disconnect())
