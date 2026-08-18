import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // Clear existing data
  await prisma.webhookLog.deleteMany();
  await prisma.transactionLog.deleteMany();
  await prisma.transaction.deleteMany();
  await prisma.application.deleteMany();

  console.log('🗑️  Cleared existing data');

  // Seed Applications
  const applications = await Promise.all([
    // HST001 - HST Backend Production (Requester)
    prisma.application.create({
      data: {
        code: 'HST001',
        name: 'HST Backend Production',
        type: 'REQUESTER',
        apiKey: 'hst001-api-key-dummy-32chars-min!',
        webhookSecret: 'hst001-webhook-secret-dummy-32chars!',
        isActive: true,
        allowedIps: [
          '127.0.0.1',
          '::1',
          '10.0.0.1',
        ],
      },
    }),
    // HSC002 - HSC Backend Staging (Requester)
    prisma.application.create({
      data: {
        code: 'HSC002',
        name: 'HSC Backend Staging',
        type: 'REQUESTER',
        apiKey: 'hsc002-api-key-dummy-32chars-min!',
        webhookSecret: 'hsc002-webhook-secret-dummy-32chars!',
        isActive: true,
        allowedIps: [
          '127.0.0.1',
          '::1',
          '192.168.1.100',
        ],
      },
    }),
    // WRP001 - Wristpay Processor (Processor)
    prisma.application.create({
      data: {
        code: 'WRP001',
        name: 'Wristpay Processor',
        type: 'PROCESSOR',
        apiKey: 'wrp001-api-key-dummy-32chars-min!',
        isActive: true,
        allowedIps: [
          '127.0.0.1',
          '::1',
          '192.168.1.50',
        ],
      },
    }),
  ]);

  console.log(`✅ Created ${applications.length} applications:`);
  applications.forEach((app) => {
    console.log(`   - ${app.code}: ${app.name} (${app.type})`);
    console.log(`     API Key: ${app.apiKey}`);
    console.log(`     Allowed IPs: ${(app as any).allowedIps?.join(', ') || 'N/A'}`);
    if (app.webhookSecret) {
      console.log(`     Webhook Secret: ${app.webhookSecret}`);
    }
  });

  console.log('\n✨ Seed completed successfully!');
  console.log('\n📝 Test Credentials:');
  console.log('   HST001: hst001-api-key-dummy-32chars-min!');
  console.log('   HSC002: hsc002-api-key-dummy-32chars-min!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
