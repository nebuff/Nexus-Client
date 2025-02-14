const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const msmc = require('msmc');

let mainWindow = null;

function createMainWindow() {
    mainWindow = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            enableRemoteModule: true
        }
    });

    mainWindow.loadFile('index.html');
}

// Wait for app to be ready
app.whenReady().then(async () => {
    createMainWindow();

    try {
        console.log('Starting Microsoft authentication...');
        
        const result = await msmc.fastLaunch("electron", (update) => {
            if (update.type === "Url") {
                console.log('Opening auth URL:', update.data);
                shell.openExternal(update.data);
            }
        });

        console.log('Authentication result:', result);

        if (!msmc.errorCheck(result)) {
            const auth = msmc.getMCLC().getAuth(result);
            console.log('Auth details:', auth);
            mainWindow.webContents.send('auth-success', auth);
        } else {
            throw new Error('Authentication failed or was cancelled');
        }
    } catch (error) {
        console.error('Authentication error:', error);
        mainWindow.webContents.send('auth-failure', error.message);
    }
});

// Handle window management
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createMainWindow();
    }
});

// Handle IPC messages
ipcMain.on('log', (event, message) => {
    console.log(message);
});

ipcMain.on('open-url', (event, url) => {
    shell.openExternal(url);
});
