const { ipcRenderer } = require('electron');
const msmc = require('msmc');

document.getElementById('login-button').addEventListener('click', () => {
  ipcRenderer.send('login');
});

ipcRenderer.on('open-auth-window', (event, url) => {
  msmc.auth(url).then(result => {
    if (msmc.errorCheck(result)) {
      console.log("Login failed");
    } else {
      console.log("Login successful");
      ipcRenderer.send('auth-success', result);
    }
  }).catch(err => {
    console.error("Authentication error:", err);
  });
});
