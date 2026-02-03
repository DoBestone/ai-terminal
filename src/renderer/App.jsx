import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import './styles/app.css';

const { ipcRenderer } = window.require('electron');

// 格式化字节
const formatBytes = (bytes) => {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

// 格式化运行时间
const formatUptime = (seconds) => {
  if (!seconds) return '-';
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}天${hours}时`;
  if (hours > 0) return `${hours}时${mins}分`;
  return `${mins}分钟`;
};

// 状态栏组件
const StatusBar = ({ info, type, host }) => {
  if (!info) {
    return (
      <div className="status-bar">
        <div className="status-item">
          <span className="status-label">状态</span>
          <span className="status-value">等待连接...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="status-bar">
      <div className="status-item">
        <span className="status-icon">🖥️</span>
        <span className="status-label">主机</span>
        <span className="status-value">{info.hostname || host}</span>
      </div>
      <div className="status-item">
        <span className="status-icon">⚡</span>
        <span className="status-label">CPU</span>
        <span className={`status-value ${info.cpuUsage > 80 ? 'warning' : ''}`}>
          {info.cpuUsage?.toFixed(1) || 0}%
        </span>
        <div className="status-progress">
          <div className="progress-bar" style={{ width: `${Math.min(info.cpuUsage || 0, 100)}%` }} />
        </div>
      </div>
      <div className="status-item">
        <span className="status-icon">💾</span>
        <span className="status-label">内存</span>
        <span className={`status-value ${info.memPercent > 80 ? 'warning' : ''}`}>
          {formatBytes(info.memUsed)} / {formatBytes(info.memTotal)} ({info.memPercent?.toFixed(0)}%)
        </span>
        <div className="status-progress">
          <div className="progress-bar memory" style={{ width: `${Math.min(info.memPercent || 0, 100)}%` }} />
        </div>
      </div>
      {type === 'ssh' && info.netRx !== undefined && (
        <div className="status-item">
          <span className="status-icon">🌐</span>
          <span className="status-label">网络</span>
          <span className="status-value">
            ↓{formatBytes(info.netRx)} ↑{formatBytes(info.netTx)}
          </span>
        </div>
      )}
      {type === 'local' && info.loadavg && (
        <div className="status-item">
          <span className="status-icon">📊</span>
          <span className="status-label">负载</span>
          <span className="status-value">
            {info.loadavg.map(l => l.toFixed(2)).join(' / ')}
          </span>
        </div>
      )}
      <div className="status-item">
        <span className="status-icon">⏱️</span>
        <span className="status-label">运行</span>
        <span className="status-value">
          {type === 'local' ? formatUptime(info.uptime) : info.uptime}
        </span>
      </div>
    </div>
  );
};

// AI Agent系统提示词
const AGENT_SYSTEM_PROMPT = `你是一个终端AI助手，可以帮助用户执行命令和管理系统。

当用户请求执行某些任务时，你应该：
1. 分析用户需求
2. 生成需要执行的命令
3. 使用 [EXECUTE] 标记来执行命令

命令格式：
[EXECUTE]命令内容[/EXECUTE]

例如：
- 用户说"列出当前目录文件"，你应该回复：
  好的，我来列出当前目录的文件：
  [EXECUTE]ls -la[/EXECUTE]

- 用户说"查看系统内存"，你应该回复：
  我来查看系统内存使用情况：
  [EXECUTE]free -h[/EXECUTE]
  或Mac上：
  [EXECUTE]vm_stat[/EXECUTE]

注意：
- 危险命令（如rm -rf /）需要先警告用户
- 一次可以执行多个命令
- 执行完命令后分析结果并给出建议`;

function App() {
  const [activeTab, setActiveTab] = useState('local');
  const [sshConfig, setSshConfig] = useState({ host: '', port: '22', username: '', password: '' });
  const [sshStatus, setSshStatus] = useState({ status: 'disconnected', message: '' });
  const [aiInput, setAiInput] = useState('');
  const [aiMessages, setAiMessages] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [apiKey, setApiKey] = useState(localStorage.getItem('openai_api_key') || '');
  const [showSettings, setShowSettings] = useState(false);
  const [terminalError, setTerminalError] = useState('');
  const [localSystemInfo, setLocalSystemInfo] = useState(null);
  const [sshSystemInfo, setSshSystemInfo] = useState(null);

  const terminalRef = useRef(null);
  const sshTerminalRef = useRef(null);
  const termInstance = useRef(null);
  const sshTermInstance = useRef(null);
  const fitAddon = useRef(null);
  const sshFitAddon = useRef(null);
  const messagesEndRef = useRef(null);

  // 滚动到最新消息
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [aiMessages]);

  // 初始化本地终端 - 组件挂载时就初始化
  useEffect(() => {
    if (terminalRef.current && !termInstance.current) {
      const term = new Terminal({
        theme: {
          background: '#1a1a2e',
          foreground: '#eee',
          cursor: '#f39c12',
          cursorAccent: '#1a1a2e',
          selection: 'rgba(248, 28, 229, 0.3)',
        },
        fontSize: 14,
        fontFamily: 'Menlo, Monaco, "Courier New", monospace',
        cursorBlink: true,
        scrollback: 10000,
      });

      const fit = new FitAddon();
      fitAddon.current = fit;
      term.loadAddon(fit);
      term.open(terminalRef.current);

      setTimeout(() => fit.fit(), 100);

      termInstance.current = term;

      // 监听终端错误
      ipcRenderer.on('terminal-error', (event, error) => {
        setTerminalError(error);
        term.writeln(`\r\n\x1b[31m错误: ${error}\x1b[0m\r\n`);
      });

      ipcRenderer.on('terminal-ready', () => {
        setTerminalError('');
      });

      // 创建PTY进程
      ipcRenderer.send('terminal-create');

      // 接收终端输出
      ipcRenderer.on('terminal-data', (event, data) => {
        term.write(data);
      });

      // 发送终端输入
      term.onData((data) => {
        ipcRenderer.send('terminal-input', data);
      });

      // 处理窗口大小变化
      const handleResize = () => {
        if (fitAddon.current && termInstance.current) {
          fitAddon.current.fit();
          ipcRenderer.send('terminal-resize', {
            cols: termInstance.current.cols,
            rows: termInstance.current.rows,
          });
        }
      };

      window.addEventListener('resize', handleResize);
      setTimeout(handleResize, 200);

      return () => {
        window.removeEventListener('resize', handleResize);
      };
    }
  }, []); // 移除 activeTab 依赖，只在挂载时运行

  // 初始化SSH终端 - 组件挂载时就初始化
  useEffect(() => {
    if (sshTerminalRef.current && !sshTermInstance.current) {
      const term = new Terminal({
        theme: {
          background: '#1a1a2e',
          foreground: '#eee',
          cursor: '#f39c12',
        },
        fontSize: 14,
        fontFamily: 'Menlo, Monaco, "Courier New", monospace',
        cursorBlink: true,
        scrollback: 10000,
      });

      const fit = new FitAddon();
      sshFitAddon.current = fit;
      term.loadAddon(fit);
      term.open(sshTerminalRef.current);
      setTimeout(() => fit.fit(), 100);

      sshTermInstance.current = term;

      term.writeln('SSH终端就绪，请在上方配置连接信息后点击"连接"');
      term.writeln('');

      // 接收SSH数据
      ipcRenderer.on('ssh-data', (event, data) => {
        term.write(data);
      });

      // 接收SSH状态
      ipcRenderer.on('ssh-status', (event, status) => {
        setSshStatus(status);
        if (status.status === 'connected') {
          term.clear();
        } else if (status.status === 'error') {
          term.writeln(`\r\n\x1b[31m${status.message}\x1b[0m\r\n`);
        } else if (status.status === 'disconnected') {
          term.writeln(`\r\n\x1b[33m${status.message}\x1b[0m\r\n`);
        }
      });

      // 发送SSH输入
      term.onData((data) => {
        ipcRenderer.send('ssh-input', data);
      });

      const handleResize = () => {
        if (sshFitAddon.current && sshTermInstance.current) {
          sshFitAddon.current.fit();
          ipcRenderer.send('ssh-resize', {
            cols: sshTermInstance.current.cols,
            rows: sshTermInstance.current.rows,
          });
        }
      };

      window.addEventListener('resize', handleResize);

      return () => {
        window.removeEventListener('resize', handleResize);
      };
    }
  }, []); // 移除 activeTab 依赖，只在挂载时运行

  // 切换tab时重新调整终端大小
  useEffect(() => {
    setTimeout(() => {
      if (activeTab === 'local' && fitAddon.current && termInstance.current) {
        fitAddon.current.fit();
        ipcRenderer.send('terminal-resize', {
          cols: termInstance.current.cols,
          rows: termInstance.current.rows,
        });
      } else if (activeTab === 'ssh' && sshFitAddon.current && sshTermInstance.current) {
        sshFitAddon.current.fit();
        ipcRenderer.send('ssh-resize', {
          cols: sshTermInstance.current.cols,
          rows: sshTermInstance.current.rows,
        });
      }
    }, 50);
  }, [activeTab]);

  // 获取本地系统信息
  useEffect(() => {
    const fetchLocalInfo = async () => {
      try {
        const info = await ipcRenderer.invoke('local-system-info');
        setLocalSystemInfo(info);
      } catch (e) {
        console.error('获取本地系统信息失败:', e);
      }
    };

    fetchLocalInfo();
    const interval = setInterval(fetchLocalInfo, 3000);
    return () => clearInterval(interval);
  }, []);

  // 获取SSH服务器系统信息
  useEffect(() => {
    let interval;

    const fetchSSHInfo = async () => {
      if (sshStatus.status !== 'connected') {
        setSshSystemInfo(null);
        return;
      }

      try {
        // 获取CPU、内存、网络等信息
        const [cpuResult, memResult, netResult, uptimeResult, hostnameResult] = await Promise.all([
          ipcRenderer.invoke('ssh-exec', "top -bn1 | grep 'Cpu(s)' | awk '{print $2}' | cut -d'%' -f1"),
          ipcRenderer.invoke('ssh-exec', "free -b | awk 'NR==2{printf \"%d %d %.1f\", $2, $3, $3*100/$2}'"),
          ipcRenderer.invoke('ssh-exec', "cat /proc/net/dev | awk 'NR>2{rx+=$2;tx+=$10}END{print rx,tx}'"),
          ipcRenderer.invoke('ssh-exec', "uptime -p 2>/dev/null || uptime | awk -F'up ' '{print $2}' | awk -F',' '{print $1}'"),
          ipcRenderer.invoke('ssh-exec', "hostname"),
        ]);

        const memParts = memResult.output.split(' ');
        const netParts = netResult.output.split(' ');

        setSshSystemInfo({
          hostname: hostnameResult.output || sshConfig.host,
          cpuUsage: parseFloat(cpuResult.output) || 0,
          memTotal: parseInt(memParts[0]) || 0,
          memUsed: parseInt(memParts[1]) || 0,
          memPercent: parseFloat(memParts[2]) || 0,
          netRx: parseInt(netParts[0]) || 0,
          netTx: parseInt(netParts[1]) || 0,
          uptime: uptimeResult.output || '-',
        });
      } catch (e) {
        console.error('获取SSH系统信息失败:', e);
      }
    };

    if (sshStatus.status === 'connected') {
      fetchSSHInfo();
      interval = setInterval(fetchSSHInfo, 3000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [sshStatus.status, sshConfig.host]);

  // SSH连接
  const handleSSHConnect = () => {
    if (!sshConfig.host || !sshConfig.username) {
      setSshStatus({ status: 'error', message: '请填写主机地址和用户名' });
      return;
    }
    setSshStatus({ status: 'connecting', message: '正在连接...' });
    ipcRenderer.send('ssh-connect', {
      host: sshConfig.host,
      port: parseInt(sshConfig.port) || 22,
      username: sshConfig.username,
      password: sshConfig.password,
    });
  };

  const handleSSHDisconnect = () => {
    ipcRenderer.send('ssh-disconnect');
  };

  // 执行命令（AI Agent用）
  const executeCommand = useCallback(async (command) => {
    return await ipcRenderer.invoke('agent-execute', command);
  }, []);

  // 解析AI响应中的命令
  const parseAndExecuteCommands = useCallback(async (text) => {
    const regex = /\[EXECUTE\]([\s\S]*?)\[\/EXECUTE\]/g;
    let match;
    const results = [];

    while ((match = regex.exec(text)) !== null) {
      const command = match[1].trim();
      if (command) {
        const result = await executeCommand(command);
        results.push({ command, ...result });
      }
    }

    return results;
  }, [executeCommand]);

  // AI对话处理
  const handleAISend = async () => {
    if (!aiInput.trim() || isProcessing) return;

    const userMessage = { role: 'user', content: aiInput };
    setAiMessages((prev) => [...prev, userMessage]);
    setAiInput('');
    setIsProcessing(true);

    try {
      // 使用OpenAI API
      if (!apiKey) {
        setAiMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: '请先在设置中配置API Key。点击右上角的设置按钮。',
          },
        ]);
        setIsProcessing(false);
        return;
      }

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4',
          messages: [
            { role: 'system', content: AGENT_SYSTEM_PROMPT },
            ...aiMessages.filter((m) => m.role !== 'system' && m.role !== 'result'),
            userMessage,
          ],
          temperature: 0.7,
        }),
      });

      if (!response.ok) {
        throw new Error(`API错误: ${response.status}`);
      }

      const data = await response.json();
      const aiContent = data.choices[0].message.content;

      setAiMessages((prev) => [...prev, { role: 'assistant', content: aiContent }]);

      // 解析并执行命令
      const commandResults = await parseAndExecuteCommands(aiContent);
      if (commandResults.length > 0) {
        for (const result of commandResults) {
          setAiMessages((prev) => [
            ...prev,
            {
              role: 'result',
              command: result.command,
              output: result.output,
              success: result.success,
            },
          ]);
        }
      }
    } catch (error) {
      setAiMessages((prev) => [
        ...prev,
        { role: 'assistant', content: `错误: ${error.message}` },
      ]);
    } finally {
      setIsProcessing(false);
    }
  };

  // 保存API Key
  const saveApiKey = () => {
    localStorage.setItem('openai_api_key', apiKey);
    setShowSettings(false);
  };

  // 快捷执行命令
  const quickExecute = async (command) => {
    setAiMessages((prev) => [...prev, { role: 'user', content: `执行: ${command}` }]);
    setIsProcessing(true);

    const result = await executeCommand(command);
    setAiMessages((prev) => [
      ...prev,
      {
        role: 'result',
        command: command,
        output: result.output,
        success: result.success,
      },
    ]);

    setIsProcessing(false);
  };

  return (
    <div className="app">
      <div className="sidebar">
        <div className="logo">
          <span className="logo-icon">⚡</span>
          AI Terminal
        </div>
        <nav className="nav">
          <button
            className={`nav-item ${activeTab === 'local' ? 'active' : ''}`}
            onClick={() => setActiveTab('local')}
          >
            <span className="nav-icon">💻</span>
            本地终端
          </button>
          <button
            className={`nav-item ${activeTab === 'ssh' ? 'active' : ''}`}
            onClick={() => setActiveTab('ssh')}
          >
            <span className="nav-icon">🔐</span>
            SSH连接
          </button>
          <button
            className={`nav-item ${activeTab === 'ai' ? 'active' : ''}`}
            onClick={() => setActiveTab('ai')}
          >
            <span className="nav-icon">🤖</span>
            AI Agent
          </button>
        </nav>
        <div className="sidebar-footer">
          <button className="settings-btn" onClick={() => setShowSettings(true)}>
            ⚙️ 设置
          </button>
        </div>
      </div>

      <div className="main-content">
        {/* 本地终端 - 使用CSS隐藏而非条件渲染 */}
        <div className="terminal-container" style={{ display: activeTab === 'local' ? 'flex' : 'none' }}>
          <div className="terminal-header">
            <span>本地终端</span>
            {terminalError && <span className="error-badge">{terminalError}</span>}
          </div>
          <div ref={terminalRef} className="terminal" />
          <StatusBar info={localSystemInfo} type="local" />
        </div>

        {/* SSH终端 - 使用CSS隐藏而非条件渲染 */}
        <div className="ssh-container" style={{ display: activeTab === 'ssh' ? 'flex' : 'none' }}>
            <div className="ssh-header">
              <div className="ssh-form">
                <input
                  type="text"
                  value={sshConfig.host}
                  onChange={(e) => setSshConfig({ ...sshConfig, host: e.target.value })}
                  placeholder="主机地址"
                  className="ssh-input"
                />
                <input
                  type="text"
                  value={sshConfig.port}
                  onChange={(e) => setSshConfig({ ...sshConfig, port: e.target.value })}
                  placeholder="端口"
                  className="ssh-input small"
                />
                <input
                  type="text"
                  value={sshConfig.username}
                  onChange={(e) => setSshConfig({ ...sshConfig, username: e.target.value })}
                  placeholder="用户名"
                  className="ssh-input"
                />
                <input
                  type="password"
                  value={sshConfig.password}
                  onChange={(e) => setSshConfig({ ...sshConfig, password: e.target.value })}
                  placeholder="密码"
                  className="ssh-input"
                />
                {sshStatus.status === 'connected' ? (
                  <button className="ssh-btn disconnect" onClick={handleSSHDisconnect}>
                    断开
                  </button>
                ) : (
                  <button
                    className="ssh-btn connect"
                    onClick={handleSSHConnect}
                    disabled={sshStatus.status === 'connecting'}
                  >
                    {sshStatus.status === 'connecting' ? '连接中...' : '连接'}
                  </button>
                )}
              </div>
              <div className={`ssh-status ${sshStatus.status}`}>
                {sshStatus.message || '未连接'}
              </div>
            </div>
            <div ref={sshTerminalRef} className="terminal" />
            <StatusBar info={sshSystemInfo} type="ssh" host={sshConfig.host} />
        </div>

        {/* AI Agent - 使用CSS隐藏而非条件渲染 */}
        <div className="ai-panel" style={{ display: activeTab === 'ai' ? 'flex' : 'none' }}>
            <div className="ai-header">
              <h2>🤖 AI Agent</h2>
              <p>让AI帮你执行终端命令，支持自然语言交互</p>
            </div>

            <div className="quick-commands">
              <span>快捷命令:</span>
              <button onClick={() => quickExecute('ls -la')}>列出文件</button>
              <button onClick={() => quickExecute('pwd')}>当前目录</button>
              <button onClick={() => quickExecute('df -h')}>磁盘空间</button>
              <button onClick={() => quickExecute('ps aux | head -20')}>进程列表</button>
            </div>

            <div className="ai-messages">
              {aiMessages.length === 0 && (
                <div className="ai-welcome">
                  <h3>欢迎使用 AI Agent</h3>
                  <p>你可以用自然语言让我帮你执行终端命令，例如：</p>
                  <ul>
                    <li>"列出当前目录的所有文件"</li>
                    <li>"查看系统内存使用情况"</li>
                    <li>"创建一个名为test的文件夹"</li>
                    <li>"查找所有.js文件"</li>
                  </ul>
                </div>
              )}
              {aiMessages.map((msg, idx) => (
                <div key={idx} className={`message ${msg.role}`}>
                  {msg.role === 'user' && (
                    <div className="message-content user-message">{msg.content}</div>
                  )}
                  {msg.role === 'assistant' && (
                    <div className="message-content assistant-message">
                      <pre>{msg.content}</pre>
                    </div>
                  )}
                  {msg.role === 'result' && (
                    <div className={`message-content result-message ${msg.success ? 'success' : 'error'}`}>
                      <div className="result-header">
                        <span className="result-icon">{msg.success ? '✅' : '❌'}</span>
                        <code>{msg.command}</code>
                      </div>
                      <pre className="result-output">{msg.output}</pre>
                    </div>
                  )}
                </div>
              ))}
              {isProcessing && (
                <div className="message assistant">
                  <div className="message-content loading">
                    <span className="loading-dots">思考中...</span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            <div className="ai-input-area">
              <textarea
                value={aiInput}
                onChange={(e) => setAiInput(e.target.value)}
                placeholder="输入你想执行的任务，例如：'帮我查看系统信息'"
                disabled={isProcessing}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleAISend();
                  }
                }}
              />
              <button onClick={handleAISend} disabled={isProcessing || !aiInput.trim()}>
                {isProcessing ? '执行中...' : '发送'}
              </button>
            </div>
          </div>
        </div>

      {/* 设置弹窗 */}
      {showSettings && (
        <div className="modal-overlay" onClick={() => setShowSettings(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>设置</h2>
            <div className="form-group">
              <label>OpenAI API Key</label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-..."
              />
              <small>用于AI Agent功能，支持GPT-4模型</small>
            </div>
            <div className="modal-actions">
              <button className="btn-cancel" onClick={() => setShowSettings(false)}>
                取消
              </button>
              <button className="btn-save" onClick={saveApiKey}>
                保存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
