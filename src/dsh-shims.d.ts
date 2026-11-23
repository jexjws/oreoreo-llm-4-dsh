/**
 * Ambient declarations for the DSH host packages this plugin depends on.
 *
 * The real packages are published on `next` tags that npm's peer resolution
 * refuses to install into a standalone project, so the plugin declares the
 * narrow slice it uses. Each declaration here mirrors a signature that was read
 * out of the published `.d.ts` files — they are transcribed, not invented, and
 * a drift in the upstream shape shows up as a compile error here.
 */

declare module '@deepseek-ai/cordis' {
  /** One loaded plugin instance. */
  export interface Context {
    /** Run `callback` once every service in `inject` exists. */
    inject(
      inject: string[],
      callback: (child: Context) => void,
    ): void;
    /** Read a service by name. */
    get(name: string): unknown;
    /** Register a disposer tied to this fiber, created by `factory`. */
    effect(factory: () => (() => void) | void, label?: string): void;
    /** Scoped logger. */
    logger: {
      info(message: string): void;
      debug(message: string): void;
      warn(message: string): void;
      error(error: unknown): void;
    };
  }
}

declare module '@deepseek-ai/schemastery' {
  /** A runtime schema usable as a Cordis `Config`. */
  export interface Schema<T> {
    (value: unknown): T;
  }

  interface StringSchema {
    default(value: string): StringSchema;
    description(text: string): StringSchema;
    required(): StringSchema;
  }
  interface NumberSchema {
    default(value: number): NumberSchema;
    description(text: string): NumberSchema;
    required(): NumberSchema;
  }
  interface BooleanSchema {
    default(value: boolean): BooleanSchema;
    description(text: string): BooleanSchema;
  }
  interface UnionSchema<T> {
    description(text: string): UnionSchema<T>;
  }
  interface ArraySchema<T> {
    default(value: T[]): ArraySchema<T>;
    description(text: string): ArraySchema<T>;
  }
  interface ObjectSchema<T> {
    description(text: string): ObjectSchema<T>;
  }

  /** Exported shape of {@link Schema.object}; named so consumers can annotate. */
  export type ObjectConfig<T> = ObjectSchema<T> & Schema<T>;

  const Schema: {
    <T>(value: T): Schema<T>;
    object<T>(dict: { [K in keyof T]: unknown }): ObjectConfig<T>;
    string(): StringSchema;
    number(): NumberSchema;
    boolean(): BooleanSchema;
    array<T>(inner: unknown): ArraySchema<T>;
    union<T>(list: unknown[]): UnionSchema<T>;
    const<T>(value: T): unknown;
    any(): UnionSchema<unknown>;
  };

  export default Schema;
}
