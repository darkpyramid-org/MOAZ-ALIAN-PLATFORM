function readPackage(pkg, _context) {
  if (pkg.name === '@prisma/config' && pkg.dependencies && pkg.dependencies['deepmerge-ts']) {
    pkg.dependencies['deepmerge-ts'] = '^8.0.0';
  }
  // Also force any deepmerge-ts reference to 8.x.
  if (pkg.dependencies && pkg.dependencies['deepmerge-ts']) {
    pkg.dependencies['deepmerge-ts'] = '^8.0.0';
  }
  if (pkg.optionalDependencies && pkg.optionalDependencies['deepmerge-ts']) {
    pkg.optionalDependencies['deepmerge-ts'] = '^8.0.0';
  }
  return pkg;
}

module.exports = { hooks: { readPackage } };
