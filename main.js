const electron = require('electron');
const app = electron.app;

const BrowserWindow = electron.BrowserWindow;

let mainWindow;
let count = 0;
let timer;

let ipcBrokerProcess;
let ipcBridge;
const ipcBusModule = require('electron-ipc-bus');
const busPath = '58769';
console.log('IPC Bus Path : ' + busPath);
const ipcBusClient = ipcBusModule.CreateIpcBusClient(busPath);

const child_process = require('child_process');
const path = require('path');
const url = require('url');

const mainURL = url.format({
  pathname: path.join(__dirname, 'index.html'),
  protocol: 'file:',
  slashes: true
});

process.on('unhandledRejection', up => { throw up; });

function spawnNodeInstance(scriptPath) {
  const args = [path.join(__dirname, scriptPath), '--parent-pid=' + process.pid, '--bus-path=' + busPath];

  let options = { env: {} };
  for (let key of Object.keys(process.env)) {
    options.env[key] = process.env[key];
  }

  options.env['ELECTRON_RUN_AS_NODE'] = '1';
  options.stdio = ['pipe', 'pipe', 'pipe', 'ipc'];
  return child_process.spawn(process.argv[0], args, options);
}

app.on('ready', function () {
  ipcBrokerProcess = spawnNodeInstance('BrokerNodeInstance.js');
  ipcBrokerProcess.on('message', function (msg) {
    if (msg && msg.event === 'ready') {
      console.log('<MAIN> IPC Broker is ready!');
      prepareApp();
    } else {
      console.log(`<MAIN> Received message from IPC Broker instance: ` + JSON.stringify(msg));
    }
  });
});

function prepareApp() {
  ipcBridge = ipcBusModule.CreateIpcBusBridge(busPath);
  ipcBridge.start()
    .then((msg) => {
      console.log('<MAIN> IPC bridge is ready!');
      // Setup IPC Client (and renderer bridge)
      ipcBusClient.connect('MainBus')
        .then(() => startApp());
    });
}

function startApp() {
  console.log('<MAIN> Connected to broker!');
  createWindow();
  timer = setInterval(() => {
    count++;
    ipcBusClient.send('update',count);
  }, 5000);
}

function createWindow() {
  mainWindow = new BrowserWindow({width: 400, height: 300});
  mainWindow.loadURL(mainURL);
  mainWindow.on('closed', function () {
    mainWindow = null;
  });
}

app.on('window-all-closed', function () {
  process.on('uncaughtException', function (err) {
    console.log('Caught exception: ' + err);
  });
  ipcBrokerProcess.kill();
  app.quit();
});