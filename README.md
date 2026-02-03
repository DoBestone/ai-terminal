# AI Terminal

一个基于 Electron 的现代化终端工具，支持本地终端、SSH 远程连接和 AI Agent 功能。

## 功能特性

- **本地终端** - 基于 node-pty 的完整本地 shell 支持
- **SSH 连接** - 支持密码认证的远程服务器连接
- **AI Agent** - 智能命令执行助手
- **系统监控** - 实时显示 CPU、内存等系统信息

## 截图

![AI Terminal](https://img.shields.io/badge/Platform-macOS%20%7C%20Windows%20%7C%20Linux-blue)

## 安装

```bash
# 克隆仓库
git clone https://github.com/DoBestone/ai-terminal.git
cd ai-terminal

# 安装依赖
npm install

# 重新编译原生模块
npm run rebuild
```

## 使用

```bash
# 开发模式运行
npm run dev

# 生产模式运行
npm start

# 打包应用
npm run package
```

## 技术栈

- [Electron](https://www.electronjs.org/) - 跨平台桌面应用框架
- [React](https://react.dev/) - UI 框架
- [xterm.js](https://xtermjs.org/) - 终端模拟器
- [node-pty](https://github.com/microsoft/node-pty) - 伪终端
- [ssh2](https://github.com/mscdex/ssh2) - SSH 客户端

## 项目结构

```
ai-terminal/
├── src/
│   ├── main/
│   │   └── main.js        # Electron 主进程
│   └── renderer/
│       ├── App.jsx        # React 主组件
│       ├── index.html     # HTML 入口
│       ├── index.jsx      # React 入口
│       └── styles/
│           └── app.css    # 样式文件
├── package.json
└── webpack.config.js
```

## License

MIT
