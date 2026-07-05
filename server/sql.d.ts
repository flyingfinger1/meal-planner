declare module 'sql.js' {
  interface Statement {
    bind(params?: unknown[]): void;
    getAsObject(params?: Record<string, unknown>): Record<string, unknown>;
    run(params?: unknown[]): void;
    step(): boolean;
    free(): void;
  }

  interface Database {
    run(sql: string, params?: unknown[]): Database;
    exec(sql: string): Array<{ columns: string[]; values: unknown[][] }>;
    prepare(sql: string, params?: unknown[]): Statement;
    export(): Uint8Array;
    close(): void;
    getRowsModified(): number;
  }

  interface SqlJsStatic {
    Database: new (data?: ArrayLike<number> | Buffer | null) => Database;
  }

  function initSqlJs(config?: Record<string, unknown>): Promise<SqlJsStatic>;
  export default initSqlJs;
  export type { Database, Statement, SqlJsStatic };
}
