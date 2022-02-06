const versionIgnoredInPeer = ['esbuild', 'cdktf'];
const ignoredInPeer = ['react-native'];
const sections = ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'];

function readPackage(pkg) {
  for (const ignored of versionIgnoredInPeer) {
    for (const section of sections) {
      if (pkg[section][ignored]) {
        pkg[section][ignored] = '*';
      }
    }
  }
  for (const ignored of ignoredInPeer) {
    for (const section of sections) {
      if (pkg[section][ignored]) {
        delete pkg[section][ignored];
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
