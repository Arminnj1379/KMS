import type { ClientSession, Connection } from 'mongoose';

/**
 * Runs `fn` inside a MongoDB multi-document transaction.
 * Requires a replica set (single-node rs0 in compose/dev) — standalone
 * servers throw, which is intentional (fail closed, see D-015).
 */
export async function withTransaction<T>(
  connection: Connection,
  fn: (session: ClientSession) => Promise<T>,
): Promise<T> {
  const session = await connection.startSession();
  try {
    let result!: T;
    await session.withTransaction(async () => {
      result = await fn(session);
    });
    return result;
  } finally {
    await session.endSession();
  }
}
