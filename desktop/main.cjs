const { app, BrowserWindow, dialog } = require('electron');
const { spawn } = require('child_process');
const net = require('net');
const path = require('path');

let backend;
function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => { const port = server.address().port; server.close(() => resolve(port)); });
  });
}
function backendCommand(port) {
  if (app.isPackaged) return { command: path.join(process.resourcesPath, 'backend', process.platform === 'win32' ? 'logat-server.exe' : 'logat-server'), args: ['--host', '127.0.0.1', '--port', String(port), '--no-browser'] };
  const python = process.platform === 'win32' ? 'python' : 'python3';
  return { command: python, args: [path.join(__dirname, '..', 'app.py'), '--host', '127.0.0.1', '--port', String(port), '--no-browser'], cwd: path.join(__dirname, '..') };
}
async function startBackend() {
  const port = await freePort();
  const spec = backendCommand(port);
  let failure;
  let diagnostic = '';
  backend = spawn(spec.command, spec.args, { cwd: spec.cwd, env: { ...process.env, PYTHONPATH: path.join(__dirname, '..', 'native'), ...(app.isPackaged ? { LOGAT_SYAMILAH_RESOURCE_DIR: process.resourcesPath } : {}) }, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
  const capture = (data) => { diagnostic = (diagnostic + data.toString()).slice(-6000); };
  backend.stdout.on('data', capture);
  backend.stderr.on('data', capture);
  backend.once('error', (error) => { failure = error.message; });
  backend.once('exit', (code) => { failure = `Backend berhenti (kode ${code}).`; });
  const url = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 240; i++) {
    if (failure) throw new Error(`${failure}\n${diagnostic}`);
    try { const response = await fetch(`${url}/api/health`, { signal: AbortSignal.timeout(1000) }); if (response.ok) return url; } catch {}
    await new Promise(r => setTimeout(r, 250));
  }
  throw new Error(`Backend tidak merespons. Pastikan lokasi Maktabah Syamilah tersedia.\n${diagnostic}`);
}
async function createWindow() {
  try {
    const url = await startBackend();
    const win = new BrowserWindow({ width: 1400, height: 900, minWidth: 980, minHeight: 650, webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true } });
    await win.loadURL(url);
  } catch (error) { dialog.showErrorBox('Logat Syamilah', error.message); app.quit(); }
}
app.whenReady().then(createWindow);
app.on('window-all-closed', () => { if (backend) backend.kill(); if (process.platform !== 'darwin') app.quit(); });
app.on('before-quit', () => { if (backend) backend.kill(); });
