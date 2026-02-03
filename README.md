# AI Terminal

一个基于 Electron 的现代化终端工具，集成本地终端、SSH 远程连接和 AI Agent 功能的图形化应用。

[![Platform](https://img.shields.io/badge/Platform-macOS%20%7C%20Windows%20%7C%20Linux-blue)](https://github.com/DoBestone/ai-terminal)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Node](https://img.shields.io/badge/Node-%3E%3D16.0.0-brightgreen)](https://nodejs.org/)
[![Electron](https://img.shields.io/badge/Electron-27.0.0-47848F?logo=electron)](https://www.electronjs.org/)

## ✨ 功能特性

### 🖥️ 本地终端
- 完整的本地 shell 支持（zsh、bash、PowerShell）
- 基于 xterm.js 的现代化终端界面
- 实时 CPU、内存、负载监控
- 自适应窗口大小

### 🔐 SSH 远程连接
- 支持密码认证和私钥认证
- 多会话管理，可同时连接多台服务器
- 保存连接配置，快速重连
- 实时显示远程服务器系统信息
- 网络流量监控

### 🤖 AI Agent
- 自然语言执行终端命令
- 支持 OpenAI GPT-4 模型
- 智能命令解析和执行
- 命令执行结果分析

### 🎨 现代化界面
- 使用 Lucide React 图标库
- 深色主题，护眼舒适
- 响应式设计
- macOS 原生窗口体验
- 可折叠侧边栏

## 📸 截图

> *截图即将添加*

## 🚀 快速开始

### 环境要求

- Node.js >= 16.0.0
- npm >= 7.0.0
- Python（用于编译原生模块）
- 编译工具链（macOS: Xcode Command Line Tools, Windows: Visual Studio Build Tools）

### 安装

```bash
# 克隆仓库
git clone https://github.com/DoBestone/ai-terminal.git
cd ai-terminal

# 安装依赖
npm install

# 重新编译原生模块（必须）
npm run rebuild
```

### 运行

```bash
# 开发模式（带热重载）
npm run dev

# 生产模式
npm start

# 构建前端代码
npm run build
```

### 打包

```bash
# 打包为可分发应用
npm run package
```

## 🛠️ 技术栈

### 前端
- **[Electron](https://www.electronjs.org/)** - 跨平台桌面应用框架
- **[React](https://react.dev/)** - UI 框架
- **[xterm.js](https://xtermjs.org/)** - 终端模拟器
- **[Lucide React](https://lucide.dev/)** - 现代化图标库
- **[Webpack](https://webpack.js.org/)** - 模块打包工具

### 后端
- **[node-pty](https://github.com/microsoft/node-pty)** - 伪终端支持
- **[ssh2](https://github.com/mscdex/ssh2)** - SSH2 客户端实现
- **[OpenAI API](https://openai.com/)** - AI 能力支持

## 📁 项目结构

```
ai-terminal/
├── src/
│   ├── main/
│   │   └── main.js              # Electron 主进程
│   └── renderer/
│       ├── App.jsx              # React 主组件
│       ├── index.html           # HTML 入口
│       ├── index.jsx            # React 入口
│       └── styles/
│           └── app.css          # 样式文件
├── package.json                 # 项目配置
├── webpack.config.js            # Webpack 配置
└── README.md                    # 项目文档
```

## ⚙️ 配置

### SSH 连接配置

1. 点击侧边栏的 **+** 按钮添加新连接
2. 填写主机地址、端口、用户名
3. 选择认证方式：
   - **密码认证**：输入密码
   - **私钥认证**：选择私钥文件（支持 passphrase）
4. 保存配置后点击 ▶ 按钮连接

### AI Agent 配置

1. 点击右上角的设置按钮
2. 输入 OpenAI API Key
3. 保存后即可使用 AI Agent 功能

## 🔧 开发指南

### 开发环境设置

```bash
# 安装依赖
npm install

# 启动开发模式（支持热重载）
npm run dev

# 监听文件变化自动构建
npm run watch
```

### 构建和打包

```bash
# 构建前端代码
npm run build

# 重新编译原生模块
npm run rebuild

# 打包应用
npm run package
```

### 调试

开发模式下会自动打开 Chrome DevTools。

## 📝 待办功能

- [ ] 添加更多 AI 模型支持
- [ ] 支持终端主题自定义
- [ ] 添加终端历史记录搜索
- [ ] 支持文件传输（SFTP）
- [ ] 添加多标签页支持
- [ ] 支持终端分屏
- [ ] 添加更多系统监控指标

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

1. Fork 本仓库
2. 创建你的特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交你的修改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 打开一个 Pull Request

## 📄 许可证

本项目采用 MIT 许可证。详见 [LICENSE](LICENSE) 文件。

## 👨‍💻 作者

**DoBestone**

- GitHub: [@DoBestone](https://github.com/DoBestone)

## 🙏 致谢

- [Electron](https://www.electronjs.org/) - 跨平台应用框架
- [xterm.js](https://xtermjs.org/) - 优秀的终端模拟器
- [Lucide](https://lucide.dev/) - 精美的图标库
- [OpenAI](https://openai.com/) - AI 能力支持

---

⭐ 如果这个项目对你有帮助，请给个 Star 支持一下！
