import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CashOpType } from '@prisma/client';

@Injectable()
export class CashbookService {
  constructor(private prisma: PrismaService) {}

  create(userId: string, name: string, opening: number) {
    return this.prisma.cashbook.create({ data: { userId, name, openingBalanceXof: BigInt(opening) } });
  }

  async list(userId: string) {
    const rows = await this.prisma.cashbook.findMany({
      where: { userId },
      include: { operations: { orderBy: { occurredAt: 'desc' }, take: 1 } },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((c) => ({
      ...c,
      balanceXof: (c.operations[0]?.balanceAfterXof ?? c.openingBalanceXof).toString(),
      operations: undefined,
    }));
  }

  async detail(userId: string, id: string) {
    const c = await this.prisma.cashbook.findUnique({
      where: { id },
      include: { operations: { orderBy: { occurredAt: 'desc' } } },
    });
    if (!c || c.userId !== userId) throw new NotFoundException();
    const balance = c.operations[0]?.balanceAfterXof ?? c.openingBalanceXof;
    return { ...c, balanceXof: balance.toString() };
  }

  async addOp(userId: string, id: string, dto: { type: CashOpType; label: string; amountXof: number }) {
    if (!dto.amountXof || dto.amountXof <= 0) {
      throw new BadRequestException('Le montant doit être supérieur à zéro');
    }

    const cb = await this.detail(userId, id);
    const current = BigInt(cb.balanceXof);
    const delta = dto.type === 'INCOME' ? BigInt(dto.amountXof) : -BigInt(dto.amountXof);
    const balanceAfterXof = current + delta;

    if (balanceAfterXof < 0n) {
      throw new BadRequestException('Solde insuffisant pour cette dépense');
    }

    const op = await this.prisma.cashOperation.create({
      data: { cashbookId: id, type: dto.type, label: dto.label, amountXof: BigInt(dto.amountXof), balanceAfterXof },
    });
    return {
      ...op,
      balanceAfterXof: op.balanceAfterXof.toString(),
      amountXof: op.amountXof.toString(),
      createdAt: op.occurredAt,
    };
  }

  async journal(userId: string, id: string) {
    const cb = await this.detail(userId, id);
    const ops = await this.prisma.cashOperation.findMany({
      where: { cashbookId: cb.id },
      orderBy: { occurredAt: 'desc' },
      take: 500,
    });
    return ops.map((o) => ({
      ...o,
      balanceAfterXof: o.balanceAfterXof.toString(),
      amountXof: o.amountXof.toString(),
      createdAt: o.occurredAt,
    }));
  }

  async todayStats(userId: string, id: string) {
    const cb = await this.detail(userId, id);
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const ops = await this.prisma.cashOperation.findMany({ where: { cashbookId: cb.id, occurredAt: { gte: start } } });
    const income = ops.filter((o) => o.type === 'INCOME').reduce((a, o) => a + o.amountXof, 0n);
    const expense = ops.filter((o) => o.type === 'EXPENSE').reduce((a, o) => a + o.amountXof, 0n);
    return {
      incomeXof: income.toString(),
      expenseXof: expense.toString(),
      balanceXof: cb.balanceXof,
      count: ops.length,
    };
  }
}