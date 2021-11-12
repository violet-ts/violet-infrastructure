function readPackage(pkg) {
  const ignoredInPeer = ['esbuild', 'cdktf'];
  for (const ignored of ignoredInPeer) {
    for (const section of ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']) {
      if (pkg[section][ignored]) {
        pkg[section][ignored] = '*';
      }
    }
  }
  return pkg;
}

module.exports = {
  hooks: {
    readPackage,
  },
};
