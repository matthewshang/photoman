const electron = require('electron');
const path = require('path');
const url = require('url');
const ipc = require('electron').ipcMain;
const { GoogleDrive } = require('photoman-core');

// Module to control application life.
const { app } = electron;
// Module to create native browser window.
const { BrowserWindow } = electron;

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow;
// GoogleDrive instance
let drive;
// ID of the current folder
let current = 0;

function createWindow() {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 1920,
    height: 1080,
    webPreferences: {
      nodeIntegration: true,
      // Set webSecurity to false so we can load images from the local disk
      webSecurity: false,
    }
  });

  // and load the index.html of the app.
  mainWindow.loadURL(
    url.format({
      pathname: path.join(__dirname, 'index.html'),
      protocol: 'file:',
      slashes: true
    })
  );

  // Emitted when the window is closed.
  mainWindow.on('closed', () => {
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    mainWindow = null;
  });
}

// This method zips together the ids of the children in the current
// folder with their names. Since drive.getChildren is blocking and 
// could take a (very) long time, getChildren is async.
async function getChildren() {
  const ids = drive.getChildren(current);
  const zipped = ids.map(id => [id, drive.getName(id)]);
  return zipped;
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', () => {
  createWindow();
  drive = new GoogleDrive();
  mainWindow.webContents.once('dom-ready', async () => {
    current = 0;
    const zipped = await getChildren();
    mainWindow.webContents.send('display-directory', zipped);
  })
});

// Quit when all windows are closed.
app.on('window-all-closed', () => {
  // On OS X it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (mainWindow === null) {
    createWindow();
  }
});

async function getPhotoPath() {
  return drive.getPhotoPath(current);
}

// The request-entry event is emitted by the renderer. arg is the
// (integer) id of the requested directory or photo.
ipc.on('request-entry', async (event, arg) => {
  current = arg;
  if (drive.isDirectory(current)) {
    const zipped = await getChildren();
    event.sender.send('display-directory', zipped);
  } else {
    const path = await getPhotoPath();
    event.sender.send('display-photo', path);
  }
});

// The file-back event is emitted by the renderer. 
ipc.on('file-back', async (event, arg) => {
  console.log(current);
  current = drive.getParent(current);
  const zipped = await getChildren();
  event.sender.send('display-directory', zipped);
});