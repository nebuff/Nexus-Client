const { ipcRenderer, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const { Client } = require('minecraft-launcher-core');
const https = require('https');
const os = require('os');

let auth = null;

document.getElementById('launch-button').addEventListener('click', async () => {
  const version = document.getElementById('version-select').value;
  const minecraftPath = path.join(require('os').homedir(), '.minecraft');

  // Check if Java is installed
  exec('java -version', (error, stdout, stderr) => {
    if (error) {
      document.getElementById('status-text').innerText = 'Java is not installed. Please visit http://www.java.com to install Java.';
      ipcRenderer.send('log', 'Java is not installed.');
      return;
    }

    if (!auth) {
      document.getElementById('status-text').innerText = 'Please log in with your Microsoft account.';
      ipcRenderer.send('log', 'Authentication required.');
      return;
    } else {
      if (!fs.existsSync(minecraftPath)) {
        document.getElementById('progress-container').style.display = 'block';
        installMinecraft(version);
      } else {
        launchMinecraft(version);
      }
    }
  });
});

ipcRenderer.on('auth-success', (event, authData) => {
  auth = authData;
  document.getElementById('status-text').innerText = `Logged in as ${auth.name}`;
  ipcRenderer.send('log', `Authenticated as ${auth.name}`);
});

ipcRenderer.on('auth-failure', (event, message) => {
  document.getElementById('status-text').innerText = `Authentication failed: ${message}`;
  ipcRenderer.send('log', `Authentication failed: ${message}`);
});

async function getJavaPath() {
  return new Promise((resolve, reject) => {
    // First try the default 'java' command
    exec('java -version', (error, stdout, stderr) => {
      if (!error) {
        resolve('java');
        return;
      }

      // Check common Java installation locations on macOS
      const commonPaths = [
        '/usr/bin/java',
        '/System/Library/Java/JavaVirtualMachines/current/Contents/Home/bin/java',
        '/Library/Java/JavaVirtualMachines/temurin-17.jdk/Contents/Home/bin/java',
        '/Library/Java/JavaVirtualMachines/adoptopenjdk-17.jdk/Contents/Home/bin/java'
      ];

      for (const javaPath of commonPaths) {
        if (fs.existsSync(javaPath)) {
          resolve(javaPath);
          return;
        }
      }

      reject(new Error('Java not found. Please install Java 17 or later.'));
    });
  });
}

async function downloadLWJGLNatives(basePath) {
  return new Promise((resolve, reject) => {
    const url = 'https://github.com/LWJGL/lwjgl3/releases/download/3.2.3/lwjgl-3.2.3-natives-macos-arm64.zip';
    const filePath = path.join(basePath, 'lwjgl-natives.zip');
    const file = fs.createWriteStream(filePath);

    console.log('Downloading LWJGL natives from:', url);
    https.get(url, (response) => {
      response.pipe(file);
      file.on('finish', () => {
        file.close(() => {
          console.log('LWJGL natives downloaded, extracting');
          // Extract the downloaded zip file
          const unzip = require('unzipper');
          fs.createReadStream(filePath)
            .pipe(unzip.Extract({ path: path.join(basePath, 'natives') }))
            .on('close', () => {
              fs.unlinkSync(filePath); // Delete the zip file after extraction
              console.log('LWJGL natives extracted');
              resolve();
            })
            .on('error', (err) => {
              console.log('Error extracting LWJGL natives:', err);
              reject(err);
            });
        });
      });
    }).on('error', (err) => {
      fs.unlinkSync(filePath);
      console.log('Error downloading LWJGL natives:', err);
      reject(err);
    });
  });
}

async function installMinecraft(version) {
  try {
    const javaPath = await getJavaPath();
    const launcher = new Client();
    const minecraftPath = path.join(require('os').homedir(), '.minecraft');

    // Ensure LWJGL natives are downloaded
    if (os.arch() === 'arm64') {
      console.log('ARM64 system detected, downloading LWJGL natives');
      await downloadLWJGLNatives(minecraftPath);
    }

    const opts = {
      clientPackage: null,
      authorization: auth,
      root: minecraftPath,
      version: {
        number: version,
        type: 'release'
      },
      memory: {
        max: '4G',
        min: '2G'
      },
      javaPath: javaPath,
      customArgs: process.platform === 'darwin' ? ['-XstartOnFirstThread'] : [],
      overrides: {
        natives: path.join(minecraftPath, 'natives'),
        libraries: path.join(minecraftPath, 'libraries')
      }
    };

    launcher.launch(opts);
    launcher.on('debug', (e) => updateStatus(e));
    launcher.on('data', (e) => updateStatus(e));
    launcher.on('progress', (e) => updateProgress(e));
  } catch (error) {
    document.getElementById('status-text').innerText = error.message;
    ipcRenderer.send('log', error.message);
  }
}

async function launchMinecraft(version) {
  try {
    const javaPath = await getJavaPath();
    const launcher = new Client();
    const minecraftPath = path.join(require('os').homedir(), '.minecraft');

    // Ensure LWJGL natives are downloaded
    if (os.arch() === 'arm64') {
      console.log('ARM64 system detected, downloading LWJGL natives');
      await downloadLWJGLNatives(minecraftPath);
    }

    const opts = {
      clientPackage: null,
      authorization: auth,
      root: minecraftPath,
      version: {
        number: version,
        type: 'release'
      },
      memory: {
        max: '4G',
        min: '2G'
      },
      javaPath: javaPath,
      customArgs: process.platform === 'darwin' ? [
        '-XstartOnFirstThread',
        '-Xdock:name=Minecraft',
        `-Xdock:icon=${path.join(minecraftPath, 'assets', 'objects', 'icons', 'minecraft.icns')}`,
        '-Dorg.lwjgl.librarypath=' + path.join(minecraftPath, 'natives'),
        '-Dorg.lwjgl.system.SharedLibraryExtractPath=' + path.join(minecraftPath, 'natives')
      ] : [],
      overrides: {
        gameDirectory: minecraftPath,
        natives: path.join(minecraftPath, 'natives'),
        assetRoot: path.join(minecraftPath, 'assets'),
        libraryRoot: path.join(minecraftPath, 'libraries')
      }
    };

    launcher.launch(opts);
    launcher.on('debug', (e) => ipcRenderer.send('log', e));
    launcher.on('data', (e) => ipcRenderer.send('log', e));
    launcher.on('progress', (e) => {
      updateProgress(e);
      if (e.type === 'natives-downloading') {
        console.log('Downloading natives...');
      }
    });
  } catch (error) {
    document.getElementById('status-text').innerText = error.message;
    ipcRenderer.send('log', error.message);
  }
}

function updateStatus(message) {
  ipcRenderer.send('log', message);
  document.getElementById('status-text').innerText = message;
  // Update progress bar based on message content (this is a simple example)
  const progressBar = document.getElementById('progress-bar').firstElementChild;
  if (message.includes('Downloading')) {
    progressBar.style.width = '50%';
  } else if (message.includes('Extracting')) {
    progressBar.style.width = '75%';
  } else if (message.includes('Launching')) {
    progressBar.style.width = '100%';
  }
}

function updateProgress(progress) {
  ipcRenderer.send('log', `Progress: ${progress}`);
  const progressBar = document.getElementById('progress-bar').firstElementChild;
  progressBar.style.width = `${progress}%`;
}
