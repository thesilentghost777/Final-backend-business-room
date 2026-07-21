import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { generateMatricule, generateReferralCode } from '../src/common/utils/matricule.util';

const prisma = new PrismaClient();

async function main() {
  const rounds = 12;
  const hash = (p: string) => bcrypt.hash(p, rounds);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@businessroom.test' },
    update: {},
    create: {
      email: 'admin@businessroom.test',
      passwordHash: await hash('Admin@123456'),
      fullName: 'Business Room Admin',
      address: 'HQ',
      profession: 'Administrator',
      matricule: generateMatricule(),
      referralCode: generateReferralCode(),
      roles: [Role.ADMIN, Role.SUPER_ADMIN_CFPAM, Role.MEMBER],
      profileCompleted: true,
      authProviders: ['EMAIL'],
    },
  });
  await prisma.membership.upsert({
    where: { userId: admin.id },
    update: {},
    create: { userId: admin.id, amountXof: 10000, status: 'ACTIVE', paidAt: new Date() },
  });

  const alice = await prisma.user.upsert({
    where: { email: 'alice@businessroom.test' },
    update: {},
    create: {
      email: 'alice@businessroom.test',
      passwordHash: await hash('Alice@123456'),
      fullName: 'Alice Diallo', address: 'Dakar', profession: 'Commerçante',
      matricule: generateMatricule(), referralCode: generateReferralCode(),
      roles: [Role.MEMBER, Role.INVESTOR], profileCompleted: true, authProviders: ['EMAIL'],
    },
  });
  await prisma.membership.upsert({
    where: { userId: alice.id }, update: {},
    create: { userId: alice.id, amountXof: 10000, status: 'ACTIVE', paidAt: new Date() },
  });

  // Alice a déjà rechargé son wallet pour tester les paiements internes.
  const aliceWallet = await prisma.wallet.upsert({
    where: { userId: alice.id },
    update: { balanceXof: BigInt(500000) },
    create: { userId: alice.id, balanceXof: BigInt(500000) },
  });
  await prisma.walletTransaction.create({
    data: {
      walletId: aliceWallet.id,
      type: 'TOPUP',
      category: 'TOPUP',
      amountXof: BigInt(500000),
      balanceAfterXof: BigInt(500000),
      status: 'SUCCESS',
      provider: 'MANUAL',
      description: 'Solde initial de démonstration',
    },
  });

  const bob = await prisma.user.upsert({
    where: { email: 'bob@businessroom.test' },
    update: {},
    create: {
      email: 'bob@businessroom.test',
      passwordHash: await hash('Bob@123456'),
      fullName: 'Bob Sarr', address: 'Thiès', profession: 'Agriculteur',
      matricule: generateMatricule(), referralCode: generateReferralCode(),
      referredById: alice.id,
      roles: [Role.MEMBER, Role.ENTREPRENEUR], profileCompleted: true, authProviders: ['EMAIL'],
    },
  });
  await prisma.membership.upsert({
    where: { userId: bob.id }, update: {},
    create: { userId: bob.id, amountXof: 10000, status: 'ACTIVE', paidAt: new Date() },
  });
  await prisma.wallet.upsert({
    where: { userId: bob.id },
    update: {},
    create: { userId: bob.id, balanceXof: BigInt(0) },
  });

  const pending = await prisma.user.upsert({
    where: { email: 'pending@businessroom.test' },
    update: {},
    create: {
      email: 'pending@businessroom.test',
      passwordHash: await hash('Pending@123456'),
      fullName: 'Pending Member', address: 'Saint-Louis', profession: 'Etudiant',
      referralCode: generateReferralCode(),
      roles: [Role.MEMBER], profileCompleted: true, authProviders: ['EMAIL'],
    },
  });
  await prisma.membership.upsert({
    where: { userId: pending.id }, update: {},
    create: { userId: pending.id, amountXof: 10000, status: 'PENDING' },
  });
  // Wallet pré-chargé pour permettre au membre en attente de payer son adhésion via /wallet/pay/membership
  const pendingWallet = await prisma.wallet.upsert({
    where: { userId: pending.id },
    update: { balanceXof: BigInt(15000) },
    create: { userId: pending.id, balanceXof: BigInt(15000) },
  });
  await prisma.walletTransaction.create({
    data: {
      walletId: pendingWallet.id,
      type: 'TOPUP', category: 'TOPUP',
      amountXof: BigInt(15000), balanceAfterXof: BigInt(15000),
      status: 'SUCCESS', provider: 'MANUAL',
      description: 'Recharge démo (pour tester paiement adhésion)',
    },
  });

  await prisma.sharePack.createMany({
    data: [
      { name: 'Starter (1 action)', unitPriceXof: BigInt(50000), sharesIncluded: 1 },
      { name: 'Growth (10 actions)', unitPriceXof: BigInt(50000), sharesIncluded: 10 },
      { name: 'Premium (25 actions)', unitPriceXof: BigInt(50000), sharesIncluded: 25 },
    ],
    skipDuplicates: true,
  });

  const values = await prisma.shareValueHistory.count();
  if (values === 0) {
    await prisma.shareValueHistory.create({ data: { valueXof: BigInt(50000), setById: admin.id, note: 'Initial value' } });
  }

  await prisma.assistanceCategory.createMany({
    data: [
      { name: 'Urgence médicale' }, { name: 'Appui scolaire' }, { name: 'Assistance administrative' }, { name: 'Autre' },
    ],
    skipDuplicates: true,
  });

  console.log('Seed complete.');
  console.log(`Admin login: admin@businessroom.test / Admin@123456`);
  console.log(`Member (Alice): alice@businessroom.test / Alice@123456`);
  console.log(`Member (Bob, referred by Alice): bob@businessroom.test / Bob@123456`);
  console.log(`Pending: pending@businessroom.test / Pending@123456`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
