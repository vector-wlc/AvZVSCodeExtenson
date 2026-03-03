# 参与指南

## 设置开发环境

- 克隆本仓库：
  ```sh
  git clone https://github.com/vector-wlc/AvZVSCodeExtenson.git
  cd AvZVSCodeExtenson
  ```

- 安装依赖的 npm 包：
  ```sh
  npm install
  ```

## 运行与调试

- 打开调试视图（<kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>D</kbd>），然后在启动配置下拉菜单中选择 `Run Extension`。
- 按下 <kbd>F5</kbd> 以在加载了扩展的新窗口中运行。

## 代码风格

参考 [Google TypeScript 风格指南](https://zh-google-styleguide.readthedocs.io/en/latest/google-typescript-styleguide/contents.html)。

## 翻译

- 提取待翻译文本：
  ```sh
  npx @vscode/l10n-dev export -o ./l10n ./src
  ```

更多信息见 [vscode-l10n 仓库](https://github.com/microsoft/vscode-l10n)。

## 打包与发布

见 [发布扩展](https://vscode.github.net.cn/api/working-with-extensions/publishing-extension)。

## 提交

参考 [约定式提交](https://www.conventionalcommits.org/zh-hans/v1.0.0/)。
