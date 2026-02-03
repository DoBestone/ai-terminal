const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const os = require('os');

let mainWindow;
let ptyProcess = null;
let sshConnection = null;
let sshStream = null;

// 动态加载node-pty（需要rebuild）
let pty;
try {
  pty = require('node-pty');
} catch (e) {
  console.error('node-pty加载失败，需要重新编译:', e.message);
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#1a1a2e',
  });

  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

  // 开发模式下打开DevTools
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }
}

// 创建本地终端
ipcMain.on('terminal-create', (event) => {
  if (!pty) {
    event.reply('terminal-error', 'node-pty未正确安装，请运行: npm run rebuild');
    return;
  }

  try {
    const shell = process.env.SHELL || '/bin/zsh';

    ptyProcess = pty.spawn(shell, [], {
      name: 'xterm-256color',
      cols: 80,
      rows: 24,
      cwd: os.homedir(),
      env: { ...process.env, TERM: 'xterm-256color' },
    });

    ptyProcess.onData((data) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('terminal-data', data);
      }
    });

    ptyProcess.onExit(({ exitCode }) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('terminal-exit', exitCode);
      }
    });

    event.reply('terminal-ready');
  } catch (err) {
    event.reply('terminal-error', err.message);
  }
});

// 接收终端输入
ipcMain.on('terminal-input', (event, data) => {
  if (ptyProcess) {
    ptyProcess.write(data);
  }
});

// 调整终端大小
ipcMain.on('terminal-resize', (event, { cols, rows }) => {
  if (ptyProcess) {
    try {
      ptyProcess.resize(cols, rows);
    } catch (e) {
      // ignore resize errors
    }
  }
});

// AI Agent执行命令
ipcMain.handle('agent-execute', async (event, command) => {
  return new Promise((resolve) => {
    if (!pty) {
      resolve({ success: false, output: 'node-pty未安装' });
      return;
    }

    try {
      const shell = process.env.SHELL || '/bin/zsh';
      let output = '';
      let exitCode = 0;

      const proc = pty.spawn(shell, ['-c', command], {
        name: 'xterm-256color',
        cols: 120,
        rows: 30,
        cwd: os.homedir(),
        env: { ...process.env, TERM: 'xterm-256color' },
      });

      proc.onData((data) => {
        output += data;
        // 实时发送输出到渲染进程
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('agent-output', data);
        }
      });

      proc.onExit(({ exitCode: code }) => {
        exitCode = code;
        resolve({ success: code === 0, output, exitCode });
      });

      // 超时处理
      setTimeout(() => {
        proc.kill();
        resolve({ success: false, output: output + '\n[命令超时]', exitCode: -1 });
      }, 60000);
    } catch (err) {
      resolve({ success: false, output: err.message, exitCode: -1 });
    }
  });
});

// SSH连接
const { Client } = require('ssh2');

ipcMain.on('ssh-connect', (event, config) => {
  // 关闭之前的连接
  if (sshConnection) {
    sshConnection.end();
    sshConnection = null;
    sshStream = null;
  }

  const conn = new Client();
  sshConnection = conn;

  conn.on('ready', () => {
    event.reply('ssh-status', { status: 'connected', message: '连接成功' });

    conn.shell({ term: 'xterm-256color' }, (err, stream) => {
      if (err) {
        event.reply('ssh-status', { status: 'error', message: err.message });
        return;
      }

      sshStream = stream;

      stream.on('data', (data) => {
        event.reply('ssh-data', data.toString());
      });

      stream.stderr.on('data', (data) => {
        event.reply('ssh-data', data.toString());
      });

      stream.on('close', () => {
        event.reply('ssh-status', { status: 'disconnected', message: '连接已断开' });
        sshConnection = null;
        sshStream = null;
      });

      stream.on('error', (err) => {
        event.reply('ssh-status', { status: 'error', message: `流错误: ${err.message}` });
      });
    });
  });

  conn.on('error', (err) => {
    let errorMsg = err.message;
    // 提供更友好的错误提示
    if (err.message.includes('Timed out')) {
      errorMsg = '连接超时，请检查网络或服务器地址';
    } else if (err.message.includes('authentication')) {
      errorMsg = '认证失败，请检查用户名和密码';
    } else if (err.message.includes('ECONNREFUSED')) {
      errorMsg = '连接被拒绝，请检查服务器地址和端口';
    } else if (err.message.includes('ECONNRESET')) {
      errorMsg = '连接被重置，服务器可能断开了连接';
    } else if (err.message.includes('EHOSTUNREACH')) {
      errorMsg = '无法访问主机，请检查网络连接';
    }
    event.reply('ssh-status', { status: 'error', message: `连接失败: ${errorMsg}` });
  });

  conn.on('close', () => {
    event.reply('ssh-status', { status: 'disconnected', message: '连接已关闭' });
  });

  conn.on('keyboard-interactive', (name, instructions, lang, prompts, finish) => {
    // 处理键盘交互认证（某些服务器需要）
    if (prompts.length > 0 && config.password) {
      finish([config.password]);
    } else {
      finish([]);
    }
  });

  try {
    conn.connect({
      host: config.host,
      port: config.port || 22,
      username: config.username,
      password: config.password,
      tryKeyboard: true,
      readyTimeout: 30000,
      keepaliveInterval: 10000,
      keepaliveCountMax: 3,
      algorithms: {
        kex: [
          'ecdh-sha2-nistp256',
          'ecdh-sha2-nistp384',
          'ecdh-sha2-nistp521',
          'diffie-hellman-group-exchange-sha256',
          'diffie-hellman-group14-sha256',
          'diffie-hellman-group14-sha1',
          'diffie-hellman-group1-sha1',
        ],
        cipher: [
          'aes128-ctr',
          'aes192-ctr',
          'aes256-ctr',
          'aes128-gcm',
          'aes128-gcm@openssh.com',
          'aes256-gcm',
          'aes256-gcm@openssh.com',
        ],
        serverHostKey: [
          'ssh-rsa',
          'ssh-ed25519',
          'ecdsa-sha2-nistp256',
          'ecdsa-sha2-nistp384',
          'ecdsa-sha2-nistp521',
          'rsa-sha2-256',
          'rsa-sha2-512',
        ],
        hmac: [
          'hmac-sha2-256',
          'hmac-sha2-512',
          'hmac-sha1',
        ],
      },
    });
  } catch (err) {
    event.reply('ssh-status', { status: 'error', message: err.message });
  }
});

ipcMain.on('ssh-input', (event, data) => {
  if (sshStream) {
    sshStream.write(data);
  }
});

ipcMain.on('ssh-resize', (event, { cols, rows }) => {
  if (sshStream) {
    sshStream.setWindow(rows, cols, 0, 0);
  }
});

ipcMain.on('ssh-disconnect', () => {
  if (sshConnection) {
    sshConnection.end();
    sshConnection = null;
    sshStream = null;
  }
});

// SSH执行命令获取系统信息
ipcMain.handle('ssh-exec', async (event, command) => {
  return new Promise((resolve) => {
    if (!sshConnection) {
      resolve({ success: false, output: '' });
      return;
    }

    const timeout = setTimeout(() => {
      resolve({ success: false, output: '命令执行超时' });
    }, 30000);

    sshConnection.exec(command, (err, stream) => {
      if (err) {
        clearTimeout(timeout);
        resolve({ success: false, output: err.message });
        return;
      }

      let output = '';
      stream.on('data', (data) => {
        output += data.toString();
      });
      stream.stderr.on('data', (data) => {
        output += data.toString();
      });
      stream.on('close', () => {
        clearTimeout(timeout);
        resolve({ success: true, output: output.trim() });
      });
      stream.on('error', (err) => {
        clearTimeout(timeout);
        resolve({ success: false, output: err.message });
      });
    });
  });
});

// 本地系统信息
ipcMain.handle('local-system-info', async () => {
  const os = require('os');

  const cpus = os.cpus();
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;

  // CPU使用率计算
  let totalIdle = 0, totalTick = 0;
  cpus.forEach(cpu => {
    for (let type in cpu.times) {
      totalTick += cpu.times[type];
    }
    totalIdle += cpu.times.idle;
  });
  const cpuUsage = Math.round((1 - totalIdle / totalTick) * 100);

  return {
    hostname: os.hostname(),
    platform: os.platform(),
    arch: os.arch(),
    cpuUsage: cpuUsage,
    cpuCores: cpus.length,
    memTotal: totalMem,
    memUsed: usedMem,
    memPercent: Math.round((usedMem / totalMem) * 100),
    uptime: os.uptime(),
    loadavg: os.loadavg(),
  };
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (ptyProcess) {
    ptyProcess.kill();
  }
  if (sshConnection) {
    sshConnection.end();
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
