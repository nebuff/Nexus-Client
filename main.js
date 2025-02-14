const path = require('path');
const fs = require('fs');
const { Client } = require('minecraft-launcher-core');

function isMinecraftInstalled() {
  const minecraftPath = path.join(require('os').homedir(), '.minecraft');
  return fs.existsSync(minecraftPath);
}

async function installMinecraft(auth, version) {
  const launcher = new Client();
  const opts = {
    clientPackage: null,
    authorization: auth,
    root: path.join(require('os').homedir(), '.minecraft'),
    version: {
      number: version,
      type: 'release'
    },
    memory: {
      max: '4G',
      min: '2G'
    }
  };

  return launcher.launch(opts);
}

module.exports = { isMinecraftInstalled, installMinecraft };
