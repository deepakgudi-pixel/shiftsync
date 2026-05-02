const requireFresh = (modulePath) => {
  const resolvedPath = require.resolve(modulePath);
  delete require.cache[resolvedPath];
  return require(resolvedPath);
};

const withMockedModules = async (moduleMap, run) => {
  const previousEntries = new Map();

  for (const [modulePath, mockExports] of Object.entries(moduleMap)) {
    const resolvedPath = require.resolve(modulePath);
    previousEntries.set(resolvedPath, require.cache[resolvedPath]);
    require.cache[resolvedPath] = {
      id: resolvedPath,
      filename: resolvedPath,
      loaded: true,
      exports: mockExports,
    };
  }

  try {
    return await run({ requireFresh });
  } finally {
    for (const [resolvedPath, previousEntry] of previousEntries.entries()) {
      delete require.cache[resolvedPath];
      if (previousEntry) {
        require.cache[resolvedPath] = previousEntry;
      }
    }
  }
};

module.exports = {
  requireFresh,
  withMockedModules,
};
