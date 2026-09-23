import { AssignmentStatus, Prisma } from '@prisma/client';

describe('probation PostgreSQL enum predicate', () => {
  it('casts each bound assignment status to the PostgreSQL enum type', () => {
    const predicate = Prisma.sql`assignment.status IN (${Prisma.join([
      Prisma.sql`${AssignmentStatus.ACTIVE}::"AssignmentStatus"`,
      Prisma.sql`${AssignmentStatus.ENDED}::"AssignmentStatus"`,
    ])})`;

    expect(predicate.strings.join(' ')).toContain('::"AssignmentStatus"');
    expect(predicate.values).toEqual([AssignmentStatus.ACTIVE, AssignmentStatus.ENDED]);
  });
});
