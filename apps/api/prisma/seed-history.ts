import { PrismaLibSQL } from '@prisma/adapter-libsql';
import { PrismaClient, type GlobalRole } from '@prisma/client';
import * as argon2 from 'argon2';
import { createHash } from 'node:crypto';
import { getRoleRank } from '../src/auth/roles.js';

const GENESIS_HASH =
  'GENESIS_HASH_00000000000000000000000000000000000000000000000000000000';
const MARKER_EMAIL = 'andres.mora@castlewalk.us';
const HOUR = 60 * 60 * 1000;

const STAFF = [
  ['andres.mora@castlewalk.us', 'Andres Mora', 'Payroll'],
  ['beatriz.solis@castlewalk.us', 'Beatriz Solis', 'Payroll'],
  ['carlos.nunez@castlewalk.us', 'Carlos Nunez', 'Onboarding'],
  ['diana.perez@castlewalk.us', 'Diana Perez', 'Onboarding'],
  ['elena.rios@castlewalk.us', 'Elena Rios', 'Human Resources'],
  ['fernando.gil@castlewalk.us', 'Fernando Gil', 'Human Resources'],
  ['gabriela.ortiz@castlewalk.us', 'Gabriela Ortiz', 'Support and TI'],
  ['hector.vega@castlewalk.us', 'Hector Vega', 'Support and TI'],
  ['irene.castro@castlewalk.us', 'Irene Castro', 'Development'],
  ['javier.mendez@castlewalk.us', 'Javier Mendez', 'Development'],
  ['karla.soto@castlewalk.us', 'Karla Soto', 'Design'],
  ['leonardo.diaz@castlewalk.us', 'Leonardo Diaz', 'Design'],
  ['marina.flores@castlewalk.us', 'Marina Flores', 'Marketing'],
  ['nicolas.romero@castlewalk.us', 'Nicolas Romero', 'Marketing'],
  ['olivia.paredes@castlewalk.us', 'Olivia Paredes', 'Contability'],
  ['pablo.herrera@castlewalk.us', 'Pablo Herrera', 'Contability'],
  ['renata.ibarra@castlewalk.us', 'Renata Ibarra', 'Finance'],
  ['samuel.quiroz@castlewalk.us', 'Samuel Quiroz', 'Finance'],
  ['teresa.navarro@castlewalk.us', 'Teresa Navarro', 'General gerence'],
  ['ulises.campos@castlewalk.us', 'Ulises Campos', 'General gerence'],
] as const;

const REQUESTS: Record<string, { title: string; body: string; category: string }[]> = {
  Payroll: [
    {
      title: 'Corrección de boleta de pago',
      body: 'El monto de horas extra no coincide con la boleta de este periodo. Dejo el detalle de la semana para que lo revisen.',
      category: 'Nómina',
    },
    {
      title: 'Cambio de cuenta bancaria',
      body: 'Necesito que el próximo pago se deposite en la cuenta nueva. Puedo entregar la constancia del banco.',
      category: 'Nómina',
    },
    {
      title: 'Constancia de ingresos',
      body: 'El banco pide una constancia de ingresos de los últimos tres meses para un trámite personal.',
      category: 'Constancia',
    },
  ],
  Onboarding: [
    {
      title: 'Accesos del primer día',
      body: 'El ingreso nuevo no tiene correo ni acceso al edificio. Hay que dejarlo listo antes del lunes.',
      category: 'Ingreso',
    },
    {
      title: 'Equipo para incorporación',
      body: 'Falta asignar laptop y monitor para la persona que entra esta semana.',
      category: 'Equipo',
    },
    {
      title: 'Inducción pendiente',
      body: 'La sesión de inducción no quedó agendada. Necesitamos fecha y sala.',
      category: 'Inducción',
    },
  ],
  'Human Resources': [
    {
      title: 'Solicitud de vacaciones',
      body: 'Quiero tomar cinco días de vacaciones el próximo mes. Confirmen si el saldo alcanza.',
      category: 'Vacaciones',
    },
    {
      title: 'Carta laboral',
      body: 'Necesito una carta laboral con fecha de ingreso, puesto y salario para un trámite bancario.',
      category: 'Carta laboral',
    },
    {
      title: 'Actualización de beneficiarios',
      body: 'Cambié la información de contacto de emergencia y los beneficiarios del seguro.',
      category: 'Expediente',
    },
  ],
  'Support and TI': [
    {
      title: 'VPN en el equipo nuevo',
      body: 'La laptop de reemplazo no conecta a la VPN. El cliente queda en error de certificado.',
      category: 'Acceso',
    },
    {
      title: 'Correo que no sincroniza',
      body: 'Desde el lunes el correo no baja mensajes nuevos en el teléfono ni en Outlook.',
      category: 'Correo',
    },
    {
      title: 'Permiso a carpeta compartida',
      body: 'No puedo abrir la carpeta del área. Pide credenciales y con las mías no entra.',
      category: 'Acceso',
    },
  ],
  Development: [
    {
      title: 'Error al publicar la versión',
      body: 'El despliegue de la tarde falló en la migración. Hace falta revisar el log y reintentar.',
      category: 'Despliegue',
    },
    {
      title: 'Acceso al repositorio',
      body: 'Una persona del equipo no puede clonar el repositorio. El usuario ya existe en el directorio.',
      category: 'Acceso',
    },
    {
      title: 'Falla intermitente en el tablero',
      body: 'El tablero de tickets a veces no guarda el cambio de estado. Se reproduce al arrastrar una tarjeta.',
      category: 'Incidencia',
    },
  ],
  Design: [
    {
      title: 'Piezas para la campaña',
      body: 'Necesitamos las piezas del banner y de la historia antes del viernes para poder publicarlas.',
      category: 'Campaña',
    },
    {
      title: 'Ajuste de manual de marca',
      body: 'El logo en fondo oscuro no tiene la versión aprobada. Hay que actualizar el manual.',
      category: 'Marca',
    },
    {
      title: 'Revisión de presentación',
      body: 'La presentación para gerencia tiene diapositivas desactualizadas. Pido una pasada de diseño.',
      category: 'Revisión',
    },
  ],
  Marketing: [
    {
      title: 'Calendario del mes',
      body: 'Falta cerrar el calendario de publicaciones y los responsables de cada pieza.',
      category: 'Contenido',
    },
    {
      title: 'Cifras de la campaña',
      body: 'Gerencia pidió el resultado de la campaña anterior: alcance, clics y costo.',
      category: 'Reporte',
    },
    {
      title: 'Apoyo para el evento interno',
      body: 'Hay que preparar la invitación y la pieza de recordatorio del evento de la próxima semana.',
      category: 'Evento',
    },
  ],
  Contability: [
    {
      title: 'Factura sin orden de compra',
      body: 'Llegó una factura de proveedor sin orden de compra. Hay que decir si se paga o se devuelve.',
      category: 'Factura',
    },
    {
      title: 'Reembolso de viáticos',
      body: 'Subí los comprobantes del viaje. El total no coincide con lo que muestra el sistema.',
      category: 'Reembolso',
    },
    {
      title: 'Conciliación del mes',
      body: 'Hay una diferencia en la conciliación bancaria que no logramos identificar.',
      category: 'Conciliación',
    },
  ],
  Finance: [
    {
      title: 'Pago a proveedor',
      body: 'El proveedor confirma que no recibió el pago programado para el viernes.',
      category: 'Pago',
    },
    {
      title: 'Presupuesto del trimestre',
      body: 'Necesitamos el presupuesto aprobado para poder comprometer el gasto del área.',
      category: 'Presupuesto',
    },
    {
      title: 'Flujo de caja',
      body: 'Gerencia quiere el flujo de caja de las próximas cuatro semanas antes de la reunión.',
      category: 'Reporte',
    },
  ],
  'General gerence': [
    {
      title: 'Aprobación de excepción',
      body: 'El área pide una excepción de política para cerrar un caso fuera del plazo habitual.',
      category: 'Aprobación',
    },
    {
      title: 'Informe mensual de áreas',
      body: 'Falta consolidar el informe de tickets abiertos, vencidos y cerrados del mes.',
      category: 'Informe',
    },
    {
      title: 'Cambio de responsable',
      body: 'Hay que dejar por escrito el cambio de responsable de un proceso entre dos áreas.',
      category: 'Política',
    },
  ],
};

const MONTHS = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const;

type Role = GlobalRole;
type Status = 'OPEN' | 'IN_PROGRESS' | 'WAITING' | 'RESOLVED' | 'CLOSED' | 'CANCELLED';
type Priority = (typeof PRIORITIES)[number];

type Person = {
  id: string;
  name: string;
  globalRole: Role;
  areaName: string;
};

type AuditIntent = {
  at: Date;
  actor: Person | null;
  action: string;
  result: 'SUCCESS' | 'DENIED';
  entityType: string;
  entityId?: string | null;
  areaId?: string | null;
  areaPath?: string | null;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  reason?: string | null;
};

function at(daysAgo: number, hour: number, minute = 0) {
  const date = new Date();
  date.setUTCHours(hour, minute, 0, 0);
  date.setUTCDate(date.getUTCDate() - daysAgo);
  return date;
}

function addHours(date: Date, hours: number) {
  return new Date(date.getTime() + hours * HOUR);
}

function kindFor(userIndex: number, ticketIndex: number): Status {
  if (ticketIndex === 0) return userIndex % 9 === 0 ? 'CANCELLED' : 'CLOSED';
  if (ticketIndex === 1) {
    return (['WAITING', 'IN_PROGRESS', 'RESOLVED', 'OPEN'] as const)[userIndex % 4];
  }
  return (['OPEN', 'IN_PROGRESS', 'RESOLVED'] as const)[userIndex % 3];
}

function createdFor(userIndex: number, ticketIndex: number, kind: Status) {
  if (kind === 'RESOLVED') return at(14 + (userIndex % 6), 9 + (userIndex % 5));
  if (kind === 'OPEN' || kind === 'IN_PROGRESS') {
    return at(4 + (userIndex % 18) + ticketIndex, 8 + (userIndex % 8));
  }
  if (kind === 'WAITING') return at(22 + (userIndex % 20), 10 + (userIndex % 4));
  return at(45 + userIndex * 11 + ticketIndex * 4, 8 + (userIndex % 7), (userIndex * 7) % 50);
}

function hashPayload(input: {
  seq: number;
  occurredAt: Date;
  prevHash: string;
  actorId: string | null;
  actorRole: string | null;
  action: string;
  result: string;
  entityType: string;
  entityId: string | null;
  areaId: string | null;
  areaPath: string | null;
  before: string | null;
  after: string | null;
  reason: string | null;
}) {
  return createHash('sha256').update(JSON.stringify(input)).digest('hex');
}

async function verifyChain(prisma: PrismaClient) {
  const logs = await prisma.auditLog.findMany({ orderBy: { seq: 'asc' } });
  let prevHash = GENESIS_HASH;
  for (let index = 0; index < logs.length; index += 1) {
    const entry = logs[index];
    if (entry.seq !== index + 1 || entry.prevHash !== prevHash) {
      throw new Error(`Audit chain broke at seq ${entry.seq}`);
    }
    const expected = hashPayload({
      seq: entry.seq,
      occurredAt: entry.occurredAt,
      prevHash: entry.prevHash,
      actorId: entry.actorId,
      actorRole: entry.actorRole,
      action: entry.action,
      result: entry.result,
      entityType: entry.entityType,
      entityId: entry.entityId,
      areaId: entry.areaId,
      areaPath: entry.areaPath,
      before: entry.before,
      after: entry.after,
      reason: entry.reason,
    });
    if (entry.hash !== expected) {
      throw new Error(`Audit hash mismatch at seq ${entry.seq}`);
    }
    prevHash = entry.hash;
  }
}

export async function seedHistory(prisma: PrismaClient) {
  const already = await prisma.ticket.findFirst({
    where: { requester: { email: MARKER_EMAIL } },
    select: { id: true },
  });
  if (already) {
    return { skipped: true, users: 0, tickets: 0, events: 0, audits: 0 };
  }

  const areas = await prisma.area.findMany({
    where: { name: { in: [...new Set(STAFF.map((row) => row[2]))] } },
    select: { id: true, name: true, path: true, leadUserId: true },
  });
  const areaByName = new Map(areas.map((area) => [area.name, area]));
  for (const [, , areaName] of STAFF) {
    if (!areaByName.has(areaName)) {
      throw new Error(`Area not found: ${areaName}`);
    }
  }

  const leadIds = [...new Set(areas.map((area) => area.leadUserId).filter((id): id is string => !!id))];
  const leadRows = await prisma.user.findMany({
    where: { id: { in: leadIds } },
    select: { id: true, name: true, globalRole: true },
  });
  const leadById = new Map(leadRows.map((lead) => [lead.id, lead]));
  const passwordHash = await argon2.hash('CastleWalk1');
  const hiredAt = at(320, 9);

  const people: Person[] = [];
  for (const [email, name, areaName] of STAFF) {
    const existing = await prisma.user.findUnique({
      where: { email },
      select: { id: true, name: true, globalRole: true },
    });
    const user =
      existing ??
      (await prisma.user.create({
        data: {
          email,
          name,
          passwordHash,
          globalRole: 'EMPLOYEE',
          isActive: true,
          createdAt: hiredAt,
        },
        select: { id: true, name: true, globalRole: true },
      }));
    const area = areaByName.get(areaName)!;
    await prisma.areaMembership.upsert({
      where: { userId_areaId: { userId: user.id, areaId: area.id } },
      update: { canAssign: true, canClose: true },
      create: { userId: user.id, areaId: area.id, canAssign: true, canClose: true },
    });
    people.push({
      id: user.id,
      name: user.name,
      globalRole: user.globalRole,
      areaName,
    });
  }

  const byArea = new Map<string, Person[]>();
  for (const person of people) {
    const group = byArea.get(person.areaName) ?? [];
    group.push(person);
    byArea.set(person.areaName, group);
  }

  const loginAudits: AuditIntent[] = [];
  people.forEach((person, index) => {
    loginAudits.push({
      at: at(180 - index * 6, 8, index % 40),
      actor: person,
      action: 'auth.login',
      result: 'SUCCESS',
      entityType: 'User',
      entityId: person.id,
      reason: 'Inicio de sesión',
    });
    loginAudits.push({
      at: at(1 + (index % 12), 8 + (index % 8), 10 + index),
      actor: person,
      action: 'auth.login',
      result: 'SUCCESS',
      entityType: 'User',
      entityId: person.id,
      reason: 'Inicio de sesión',
    });
  });
  for (let index = 0; index < 8; index += 1) {
    const person = people[index];
    loginAudits.push({
      at: at(2 + index, 18, 5 + index),
      actor: person,
      action: 'auth.login',
      result: 'DENIED',
      entityType: 'User',
      entityId: person.id,
      reason: 'Contraseña incorrecta',
    });
  }

  const result = await prisma.$transaction(
    async (tx) => {
      const counter = await tx.ticketCounter.findUnique({ where: { id: 1 } });
      let numberValue = counter?.value ?? 0;
      const events: {
        ticketId: string;
        actorId: string;
        type: 'READ' | 'CREATED' | 'ASSIGNED' | 'STATUS_CHANGED' | 'CLOSED';
        message: string;
        fromStatus?: Status;
        toStatus?: Status;
        createdAt: Date;
      }[] = [];
      const comments: {
        ticketId: string;
        authorId: string;
        body: string;
        visibility: 'PUBLIC' | 'INTERNAL';
        createdAt: Date;
      }[] = [];
      const watchers: { ticketId: string; userId: string; createdAt: Date }[] = [];
      const audits: AuditIntent[] = [];

      for (let userIndex = 0; userIndex < people.length; userIndex += 1) {
        const requester = people[userIndex];
        const mates = byArea.get(requester.areaName) ?? [];
        const partner = mates.find((mate) => mate.id !== requester.id);
        if (!partner) throw new Error(`No teammate for ${requester.name}`);
        const area = areaByName.get(requester.areaName)!;
        const leadRow = area.leadUserId ? leadById.get(area.leadUserId) : undefined;
        const lead: Person | null = leadRow
          ? { id: leadRow.id, name: leadRow.name, globalRole: leadRow.globalRole, areaName: area.name }
          : null;
        const templates = REQUESTS[requester.areaName];

        for (let ticketIndex = 0; ticketIndex < 3; ticketIndex += 1) {
          const kind = kindFor(userIndex, ticketIndex);
          const created = createdFor(userIndex, ticketIndex, kind);
          const template = templates[ticketIndex % templates.length];
          const month = MONTHS[created.getUTCMonth()];
          const title = `${template.title} — ${month} ${created.getUTCFullYear()}`;
          const priority = PRIORITIES[(userIndex + ticketIndex) % PRIORITIES.length];
          const handler = ticketIndex === 0 && lead ? lead : partner;
          const closer = lead ?? partner;
          numberValue += 1;
          const number = `CW-${String(numberValue).padStart(4, '0')}`;

          const story = buildStory({
            kind,
            created,
            requester,
            handler,
            closer,
            areaName: area.name,
            number,
            title,
            userIndex,
          });

          const ticket = await tx.ticket.create({
            data: {
              number,
              title,
              body: template.body,
              requesterId: requester.id,
              areaId: area.id,
              assigneeId: story.assigneeId,
              status: story.status,
              priority,
              category: template.category,
              dueAt: story.dueAt,
              waitingUntil: story.waitingUntil,
              resolvedAt: story.resolvedAt,
              closedAt: story.closedAt,
              createdAt: created,
              updatedAt: story.updatedAt,
            },
            select: { id: true },
          });

          for (const event of story.events) {
            events.push({ ...event, ticketId: ticket.id });
          }
          for (const comment of story.comments) {
            comments.push({ ...comment, ticketId: ticket.id });
          }
          const watcherIds = new Set([requester.id, story.assigneeId].filter((id): id is string => !!id));
          for (const userId of watcherIds) {
            watchers.push({ ticketId: ticket.id, userId, createdAt: created });
          }
          for (const audit of story.audits) {
            audits.push({
              ...audit,
              entityId: ticket.id,
              areaId: area.id,
              areaPath: area.path,
            });
          }
        }
      }

      for (let offset = 0; offset < events.length; offset += 40) {
        await tx.ticketEvent.createMany({ data: events.slice(offset, offset + 40) });
      }
      for (let offset = 0; offset < comments.length; offset += 40) {
        await tx.ticketComment.createMany({ data: comments.slice(offset, offset + 40) });
      }
      for (let offset = 0; offset < watchers.length; offset += 40) {
        await tx.ticketWatcher.createMany({ data: watchers.slice(offset, offset + 40) });
      }

      const chain = [...loginAudits, ...audits].sort(
        (a, b) => a.at.getTime() - b.at.getTime() || a.action.localeCompare(b.action),
      );
      let previous = await tx.auditLog.findFirst({
        orderBy: { seq: 'desc' },
        select: { seq: true, hash: true },
      });
      for (const intent of chain) {
        const seq = (previous?.seq ?? 0) + 1;
        const prevHash = previous?.hash ?? GENESIS_HASH;
        const actorId = intent.actor?.id ?? null;
        const actorRole = intent.actor?.globalRole ?? null;
        const before = intent.before ? JSON.stringify(intent.before) : null;
        const after = intent.after ? JSON.stringify(intent.after) : null;
        const reason = intent.reason ?? null;
        const entityId = intent.entityId ?? null;
        const areaId = intent.areaId ?? null;
        const areaPath = intent.areaPath ?? null;
        const hash = hashPayload({
          seq,
          occurredAt: intent.at,
          prevHash,
          actorId,
          actorRole,
          action: intent.action,
          result: intent.result,
          entityType: intent.entityType,
          entityId,
          areaId,
          areaPath,
          before,
          after,
          reason,
        });
        previous = await tx.auditLog.create({
          data: {
            seq,
            occurredAt: intent.at,
            actorId,
            actorRole,
            actorRank: intent.actor ? getRoleRank(intent.actor.globalRole) : null,
            action: intent.action,
            result: intent.result,
            entityType: intent.entityType,
            entityId,
            areaId,
            areaPath,
            before,
            after,
            reason,
            prevHash,
            hash,
          },
          select: { seq: true, hash: true },
        });
      }

      await tx.ticketCounter.upsert({
        where: { id: 1 },
        create: { id: 1, value: numberValue },
        update: { value: numberValue },
      });
      await verifyChain(tx as unknown as PrismaClient);

      return {
        tickets: people.length * 3,
        events: events.length,
        audits: chain.length,
      };
    },
    { timeout: 120_000, maxWait: 10_000 },
  );

  return { skipped: false, users: people.length, ...result };
}

function buildStory(input: {
  kind: Status;
  created: Date;
  requester: Person;
  handler: Person;
  closer: Person;
  areaName: string;
  number: string;
  title: string;
  userIndex: number;
}) {
  const { kind, created, requester, handler, closer, areaName, number, title, userIndex } = input;
  const events: {
    actorId: string;
    type: 'READ' | 'CREATED' | 'ASSIGNED' | 'STATUS_CHANGED' | 'CLOSED';
    message: string;
    fromStatus?: Status;
    toStatus?: Status;
    createdAt: Date;
  }[] = [];
  const comments: {
    authorId: string;
    body: string;
    visibility: 'PUBLIC' | 'INTERNAL';
    createdAt: Date;
  }[] = [];
  const audits: AuditIntent[] = [];
  const areaAudit = {
    entityType: 'Ticket',
    result: 'SUCCESS' as const,
  };

  const pushStatus = (atTime: Date, actor: Person, fromStatus: Status, toStatus: Status, reason: string) => {
    events.push({
      actorId: actor.id,
      type: toStatus === 'CLOSED' ? 'CLOSED' : 'STATUS_CHANGED',
      message: `Status ${fromStatus} → ${toStatus}`,
      fromStatus,
      toStatus,
      createdAt: atTime,
    });
    audits.push({
      at: atTime,
      actor,
      action: 'ticket.transition',
      ...areaAudit,
      before: { status: fromStatus },
      after: { status: toStatus },
      reason,
    });
  };

  events.push({
    actorId: requester.id,
    type: 'CREATED',
    message: `Created ${number} for ${areaName}`,
    toStatus: 'OPEN',
    createdAt: created,
  });
  audits.push({
    at: created,
    actor: requester,
    action: 'ticket.create',
    ...areaAudit,
    after: { number, title },
    reason: 'Solicitud registrada',
  });

  if (closer.id !== handler.id) {
    events.push({
      actorId: closer.id,
      type: 'READ',
      message: 'Viewed ticket detail',
      createdAt: addHours(created, 2),
    });
  }
  events.push({
    actorId: handler.id,
    type: 'READ',
    message: 'Viewed ticket detail',
    createdAt: addHours(created, 5),
  });

  if (kind === 'OPEN') {
    const dueAt =
      userIndex % 2 === 0 ? addHours(created, 48) : addHours(new Date(), 24 * 6);
    return {
      status: 'OPEN' as const,
      assigneeId: null,
      dueAt,
      waitingUntil: null,
      resolvedAt: null,
      closedAt: null,
      updatedAt: addHours(created, 5),
      events,
      comments,
      audits,
    };
  }

  const assignedAt = addHours(created, 20);
  events.push({
    actorId: closer.id,
    type: 'ASSIGNED',
    message: `Assigned to ${handler.name}`,
    createdAt: assignedAt,
  });
  audits.push({
    at: assignedAt,
    actor: closer,
    action: 'ticket.assign',
    ...areaAudit,
    after: { assigneeId: handler.id, assignee: handler.name },
    reason: `Asignado a ${handler.name}`,
  });
  comments.push({
    authorId: handler.id,
    body: 'Ya tomé el caso. Reviso la información y confirmo el siguiente paso.',
    visibility: 'PUBLIC',
    createdAt: addHours(assignedAt, 3),
  });

  const startedAt = addHours(created, 30);
  pushStatus(startedAt, handler, 'OPEN', 'IN_PROGRESS', 'Trabajo iniciado');

  if (kind === 'IN_PROGRESS') {
    comments.push({
      authorId: requester.id,
      body: 'Quedo atento si necesitan algún dato más de mi lado.',
      visibility: 'PUBLIC',
      createdAt: addHours(startedAt, 6),
    });
    return {
      status: 'IN_PROGRESS' as const,
      assigneeId: handler.id,
      dueAt: userIndex % 2 === 0 ? addHours(created, 72) : addHours(new Date(), 24 * 4),
      waitingUntil: null,
      resolvedAt: null,
      closedAt: null,
      updatedAt: addHours(startedAt, 6),
      events,
      comments,
      audits,
    };
  }

  if (kind === 'WAITING') {
    const waitingAt = addHours(startedAt, 26);
    comments.push({
      authorId: handler.id,
      body: 'Para continuar necesito el documento o la confirmación que pedí en el comentario.',
      visibility: 'PUBLIC',
      createdAt: waitingAt,
    });
    pushStatus(addHours(waitingAt, 1), handler, 'IN_PROGRESS', 'WAITING', 'En espera de respuesta');
    return {
      status: 'WAITING' as const,
      assigneeId: handler.id,
      dueAt: addHours(new Date(), 24 * 8),
      waitingUntil: addHours(new Date(), 24 * (3 + (userIndex % 5))),
      resolvedAt: null,
      closedAt: null,
      updatedAt: addHours(waitingAt, 1),
      events,
      comments,
      audits,
    };
  }

  if (kind === 'CANCELLED') {
    const cancelledAt = addHours(startedAt, 18);
    comments.push({
      authorId: requester.id,
      body: 'Ya no hace falta seguir con esto. Gracias por el tiempo.',
      visibility: 'PUBLIC',
      createdAt: cancelledAt,
    });
    pushStatus(addHours(cancelledAt, 2), closer, 'IN_PROGRESS', 'CANCELLED', 'Cancelado a petición de quien lo abrió');
    return {
      status: 'CANCELLED' as const,
      assigneeId: handler.id,
      dueAt: addHours(created, 24 * 7),
      waitingUntil: null,
      resolvedAt: null,
      closedAt: addHours(cancelledAt, 2),
      updatedAt: addHours(cancelledAt, 2),
      events,
      comments,
      audits,
    };
  }

  const resolvedAt =
    kind === 'RESOLVED'
      ? addHours(new Date(), -(36 + (userIndex % 4) * 12))
      : addHours(startedAt, 96);
  comments.push({
    authorId: handler.id,
    body: 'Quedó resuelto. Dejo constancia de lo que se hizo para el historial.',
    visibility: 'PUBLIC',
    createdAt: resolvedAt,
  });
  comments.push({
    authorId: closer.id,
    body: 'Nota interna: se contrastó con el expediente y el resultado quedó documentado.',
    visibility: 'INTERNAL',
    createdAt: addHours(resolvedAt, 1),
  });
  pushStatus(addHours(resolvedAt, 2), handler, 'IN_PROGRESS', 'RESOLVED', 'Solución registrada');

  if (kind === 'RESOLVED') {
    return {
      status: 'RESOLVED' as const,
      assigneeId: handler.id,
      dueAt: addHours(new Date(), 24 * 3),
      waitingUntil: null,
      resolvedAt: addHours(resolvedAt, 2),
      closedAt: null,
      updatedAt: addHours(resolvedAt, 2),
      events,
      comments,
      audits,
    };
  }

  const closedAt = addHours(resolvedAt, 30);
  comments.push({
    authorId: requester.id,
    body: 'Confirmo que quedó bien. Se puede cerrar.',
    visibility: 'PUBLIC',
    createdAt: addHours(resolvedAt, 20),
  });
  pushStatus(closedAt, closer, 'RESOLVED', 'CLOSED', 'Cierre confirmado');
  return {
    status: 'CLOSED' as const,
    assigneeId: handler.id,
    dueAt: addHours(created, 24 * 10),
    waitingUntil: null,
    resolvedAt: addHours(resolvedAt, 2),
    closedAt,
    updatedAt: closedAt,
    events,
    comments,
    audits,
  };
}

const entry = process.argv[1] ?? '';
if (entry.endsWith('seed-history.ts')) {
  const adapter = new PrismaLibSQL({
    url: process.env.LIBSQL_URL ?? 'http://127.0.0.1:8080',
  });
  const prisma = new PrismaClient({ adapter });
  seedHistory(prisma)
    .then((summary) => {
      console.log(summary);
    })
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
