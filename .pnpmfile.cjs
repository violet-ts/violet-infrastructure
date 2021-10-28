function readPackage(pkg) {
  const ignoredInPeer = ['esbuild', 'cdktf'];
  for (const ignored of ignoredInPeer) {
    for (const section of ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']) {
      if (pkg[section][ignored]) {
        pkg[section][ignored] = '*';
      }
    }
  }
  if (pkg.name === 'cdktf-cli') {
    // https://github.com/hashicorp/terraform-cdk/issues/1217
    pkg.dependencies.ink = '3.0.8';
  }
  return pkg;
}

module.exports = {
  hooks: {
    readPackage,
  },
};
