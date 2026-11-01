// Load-hook for generate-seed.mjs: the frontend's TS modules import "./sources" without an
// extension (their bundler resolves it). Node ESM does not, so this hook appends .ts to
// extensionless relative specifiers before resolution.
export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("./") && !/\.[a-z]+$/i.test(specifier)) {
    return nextResolve(`${specifier}.ts`, context);
  }

  return nextResolve(specifier, context);
}
