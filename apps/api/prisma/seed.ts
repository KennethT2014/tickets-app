import { PrismaLibSQL } from '@prisma/adapter-libsql';
import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';
import { slugify } from '../src/common/slug.js';

const adapter = new PrismaLibSQL({
  url: process.env.LIBSQL_URL ?? 'http://127.0.0.1:8080',
});
const prisma = new PrismaClient({ adapter });

const COMPANY_AREAS = [
  'General gerence',
  'Payroll',
  'Onboarding',
  'Human Resources',
  'Support and TI',
  'Development',
  'Design',
  'Marketing',
  'Contability',
  'Finance',
];

async function upsertUser(input: {
  email: string;
  name: string;
  password: string;
  globalRole: 'ADMIN' | 'MANAGEMENT' | 'AREA_LEAD' | 'EMPLOYEE';
}) {
  const passwordHash = await argon2.hash(input.password);
  return prisma.user.upsert({
    where: { email: input.email },
    update: { name: input.name, passwordHash, globalRole: input.globalRole, isActive: true },
    create: {
      email: input.email,
      name: input.name,
      passwordHash,
      globalRole: input.globalRole,
    },
  });
}

async function upsertArea(name: string, parentId: string | null, leadUserId: string | null) {
  const slug = slugify(name);
  return prisma.area.upsert({
    where: { slug },
    update: { name, parentId, leadUserId },
    create: { name, slug, parentId, leadUserId },
  });
}

async function ensureMember(
  userId: string,
  areaId: string,
  flags: { canAssign?: boolean; canClose?: boolean },
) {
  return prisma.areaMembership.upsert({
    where: { userId_areaId: { userId, areaId } },
    update: flags,
    create: { userId, areaId, ...flags },
  });
}

async function main() {
  const admin = await upsertUser({
    email: 'admin@castlewalk.us',
    name: 'CastleWalk Admin',
    password: 'Admin123!',
    globalRole: 'ADMIN',
  });
  await upsertUser({
    email: 'admin@ems.net',
    name: 'EMS Admin',
    password: 'messi2012',
    globalRole: 'ADMIN',
  });
  const gerencia = await upsertUser({
    email: 'gerencia@castlewalk.us',
    name: 'Elena Gerencia',
    password: 'CastleWalk1',
    globalRole: 'MANAGEMENT',
  });
  const sofia = await upsertUser({
    email: 'sofia.hr@castlewalk.us',
    name: 'Sofia Herrera',
    password: 'CastleWalk1',
    globalRole: 'AREA_LEAD',
  });
  const diego = await upsertUser({
    email: 'diego.ti@castlewalk.us',
    name: 'Diego Ramirez',
    password: 'CastleWalk1',
    globalRole: 'AREA_LEAD',
  });
  const camila = await upsertUser({
    email: 'camila.dev@castlewalk.us',
    name: 'Camila Lopez',
    password: 'CastleWalk1',
    globalRole: 'AREA_LEAD',
  });
  const lucia = await upsertUser({
    email: 'lucia.hr@castlewalk.us',
    name: 'Lucia Vargas',
    password: 'CastleWalk1',
    globalRole: 'EMPLOYEE',
  });
  const martin = await upsertUser({
    email: 'martin.employee@castlewalk.us',
    name: 'Martin Cruz',
    password: 'CastleWalk1',
    globalRole: 'EMPLOYEE',
  });

  const root = await upsertArea('CastleWalk', null, admin.id);
  const leads: Record<string, string> = {
    'General gerence': gerencia.id,
    'Human Resources': sofia.id,
    'Support and TI': diego.id,
    Development: camila.id,
  };

  const areas = new Map<string, { id: string }>();
  for (const name of COMPANY_AREAS) {
    const area = await upsertArea(name, root.id, leads[name] ?? null);
    areas.set(name, area);
  }

  const hr = areas.get('Human Resources')!;
  const ti = areas.get('Support and TI')!;
  const payroll = areas.get('Payroll')!;
  const development = areas.get('Development')!;

  await ensureMember(sofia.id, hr.id, { canAssign: true, canClose: true });
  await ensureMember(lucia.id, hr.id, { canAssign: false, canClose: true });
  await ensureMember(diego.id, ti.id, { canAssign: true, canClose: true });
  await ensureMember(camila.id, development.id, { canAssign: true, canClose: true });
  await ensureMember(martin.id, payroll.id, { canAssign: false, canClose: false });

  const existing = await prisma.ticket.findFirst({
    where: { number: 'CW-0001' },
  });
  if (!existing) {
    await prisma.ticketCounter.upsert({
      where: { id: 1 },
      update: { value: 2 },
      create: { id: 1, value: 2 },
    });
    const ticket = await prisma.ticket.create({
      data: {
        number: 'CW-0001',
        title: 'Employment letter request',
        body: 'I need an employment letter for my bank. Please include start date and current role.',
        requesterId: martin.id,
        areaId: hr.id,
        status: 'OPEN',
        priority: 'MEDIUM',
        category: 'HR letter',
      },
    });
    await prisma.ticketEvent.create({
      data: {
        ticketId: ticket.id,
        actorId: martin.id,
        type: 'CREATED',
        message: 'Created CW-0001 for Human Resources',
      },
    });
    await prisma.notification.create({
      data: {
        userId: sofia.id,
        ticketId: ticket.id,
        title: 'CW-0001',
        body: 'Martin Cruz created a request for Human Resources',
      },
    });

    const ticket2 = await prisma.ticket.create({
      data: {
        number: 'CW-0002',
        title: 'VPN access for new laptop',
        body: 'Please enable VPN on the new MacBook assigned this week.',
        requesterId: martin.id,
        areaId: ti.id,
        assigneeId: diego.id,
        status: 'IN_PROGRESS',
        priority: 'HIGH',
        category: 'Access',
      },
    });
    await prisma.ticketEvent.createMany({
      data: [
        {
          ticketId: ticket2.id,
          actorId: martin.id,
          type: 'CREATED',
          message: 'Created CW-0002 for Support and TI',
        },
        {
          ticketId: ticket2.id,
          actorId: diego.id,
          type: 'ASSIGNED',
          message: 'Assigned to Diego Ramirez',
        },
      ],
    });
  }

  console.log('Seed ready');
  console.log('  admin@ems.net / messi2012');
  console.log('  admin@castlewalk.us / Admin123!');
  console.log('  gerencia@castlewalk.us / CastleWalk1  (Gerencia)');
  console.log('  sofia.hr@castlewalk.us / CastleWalk1  (Jefe de área HR)');
  console.log('  lucia.hr@castlewalk.us / CastleWalk1  (Empleado HR closer)');
  console.log('  martin.employee@castlewalk.us / CastleWalk1  (Empleado)');
}

await main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
