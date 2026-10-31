/**
 * Content pipeline public surface.
 *
 * The domain exposes validation only. Reading files is an adapter concern
 * (docs/07-architecture.md, rule R3), so nothing here touches the filesystem.
 */

export * from './errors';
export * from './schema';
export * from './validate';
export * from './lint';
export * from './coverage';
export * from './assemble';
