import { app, BrowserWindow, ipcMain } from 'electron';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
import { getCollections, getCollectionDocuments } from './db';

process.env.APP_ROOT = path.join(__dirname, '..');

export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL'];
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron');
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist');

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, 'public') : RENDERER_DIST;

// Preload script path
const PRELOAD_PATH = path.join(MAIN_DIST, 'preload.js');

let win: BrowserWindow | null;

function createWindow() {
    console.log('Preload path:', PRELOAD_PATH);

    win = new BrowserWindow({
        width: 1200,
        height: 800,
        icon: path.join(process.env.VITE_PUBLIC!, 'icon-256x256.ico'),
        webPreferences: {
            preload: PRELOAD_PATH,
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: false
        },
    });

    // Test active push message to Renderer-process.
    win.webContents.on('did-finish-load', () => {
        win?.webContents.send('main-process-message', (new Date).toLocaleString());
    });

    if (VITE_DEV_SERVER_URL) {
        win.loadURL(VITE_DEV_SERVER_URL);
        win.webContents.openDevTools();
    } else {
        win.loadFile(path.join(RENDERER_DIST, 'index.html'));
    }
}

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
        win = null;
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});

app.whenReady().then(createWindow);

// Settings file path
const SETTINGS_DIR = path.join(os.homedir(), '.omnimongo');
const SETTINGS_FILE = path.join(SETTINGS_DIR, 'settings.json');

// Default settings
const DEFAULT_SETTINGS = {
    connections: {
        localhost: 'mongodb://localhost:27017/mydb'
    }
};

// Initialize settings file
function initializeSettings() {
    try {
        // Create directory if it doesn't exist
        if (!fs.existsSync(SETTINGS_DIR)) {
            fs.mkdirSync(SETTINGS_DIR, { recursive: true });
        }

        // Create settings file with defaults if it doesn't exist
        if (!fs.existsSync(SETTINGS_FILE)) {
            fs.writeFileSync(SETTINGS_FILE, JSON.stringify(DEFAULT_SETTINGS, null, 2), 'utf-8');
            console.log('Created settings file at:', SETTINGS_FILE);
        }
    } catch (error) {
        console.error('Failed to initialize settings:', error);
    }
}

// Initialize settings on startup
app.whenReady().then(() => {
    initializeSettings();
    createWindow();
});

// IPC handlers for settings
ipcMain.handle('settings:read', async () => {
    try {
        const data = fs.readFileSync(SETTINGS_FILE, 'utf-8');
        return JSON.parse(data);
    } catch (error: any) {
        console.error('Failed to read settings:', error);
        return DEFAULT_SETTINGS;
    }
});

ipcMain.handle('settings:write', async (event, settings) => {
    try {
        fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2), 'utf-8');
        return { success: true };
    } catch (error: any) {
        console.error('Failed to write settings:', error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('mongo:get-collections', async (event, url: string): Promise<string[]> => {
    console.log({ event, url });
    return getCollections(url);
});

ipcMain.handle('mongo:get-documents', async (event, url: string, collectionName: string, keyFields: string[]): Promise<Map<string, Record<string, any>>> => {
    console.log('Fetching documents from:', url, collectionName);
    return getCollectionDocuments(url, collectionName, keyFields);
});