/*
 * Copyright (C) 2021-2026 AsmVsZombies Team
 *
 * This file is part of AvZ VSCode Extension.
 *
 * AvZ VSCode Extension is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by the
 * Free Software Foundation, either version 3 of the License, or (at your
 * option) any later version.
 *
 * AvZ VSCode Extension is distributed in the hope that it will be useful, but
 * WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY
 * or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for
 * more details.
 *
 * You should have received a copy of the GNU General Public License along with
 * AvZ VSCode Extension. If not, see <https://www.gnu.org/licenses/>.
 */

export const generateCCppJson = (avzDir: string, envType: number) => `{
    "configurations": [{
        "name": "Windows",
        "includePath": [
            "${avzDir}/inc"
        ],
        "compilerPath": "${avzDir}/MinGW/bin/g++.exe",
        "cStandard": "c11",
        "cppStandard": "${envType === 1 ? "c++14" : "c++20"}"
    }],
    "version": 4
}`;

export const generateSettingsJson = (avzDir: string, envType: number) => `{
    // 隐藏内联提示
    "editor.inlayHints.enabled": "offUnlessPressed",

    // 保存文件时自动格式化代码
    // "editor.formatOnSave": true,

    // AvZ 库的代码风格 (在格式化时使用) (此项为微软 C/C++ 扩展专用)
    // "C_Cpp.clang_format_fallbackStyle": "{ BasedOnStyle: WebKit, AlignTrailingComments: true, Cpp11BracedListStyle: true, BreakBeforeBraces: Attach, PackConstructorInitializers: NextLineOnly, SpaceInEmptyBlock: false }",

    // 禁用微软 C/C++ 扩展的语法引擎 (使用 clangd 扩展时将此项解除注释可避免冲突)
    // "C_Cpp.intelliSenseEngine": "disabled",

    // 编译参数 (仅在 clangd 扩展分析时使用)
    "clangd.fallbackFlags": [
        "-I${avzDir}/inc",
        "-m32",
        "-std=${envType === 1 ? "c++1z" : "c++2b"}",
        ${envType === 1 ? "" : '"-fexperimental-library"'}
    ],
${envType === 1 ? "" : `
    // clangd 可执行文件路径 (clangd 扩展专用)
    "clangd.path": "${avzDir}/MinGW/bin/clangd.exe",

    // lldb 可执行文件路径 (LLDB DAP 扩展专用)
    "lldb-dap.executable-path": "${avzDir}/MinGW/bin/lldb-vscode.exe"`}
}`;

export const generateLaunchJson = (avzDir: string, _: number) => `{
    "configurations": [
        // GDB 调试器 (微软 C/C++ 扩展专用)
        // 开箱即用, 但调试功能不如 LLDB 强大 (例如无法显示标准库容器中的变量的值)
        {
            "name": "avz attach(gdb)",
            "type": "cppdbg",
            "request": "attach",
            "processId": "\${command:pickProcess}",
            "program": "\${command:AsmVsZombies.getPvzExePath}",
            "MIMode": "gdb",
            "miDebuggerPath": "${avzDir}/MinGW/bin/gdb32.exe",
            "preLaunchTask": "avz"
        },

        // LLDB 调试器 (LLDB DAP 扩展专用)
        // 能提供更好的调试体验, 但是需要满足几个条件才能使用
        // 使用此调试器时必须使用 32 位 AvZ 环境包, 并且需要安装 VSCode 扩展 "LLDB DAP"
        // 并且需要在 LLDB DAP 扩展的 "Executable-path" 设置项中填入 [AvZ 环境包的根目录]/MinGW/bin/lldb-vscode.exe
        {
            "name": "avz attach(lldb)",
            "type": "lldb-dap",
            "request": "attach",
            "program": "\${command:AsmVsZombies.getPvzExePath}",
            "preLaunchTask": "avz"
        }
    ]
}`;

export const generateTasksJson = (_1: string, _2: number) => `{
    "tasks": [
        {
            "type": "shell",
            "label": "avz",
            "command": "\${command:AsmVsZombies.runScript}",
        }
    ],
    "version": "2.0.0"
}`;

export const generateClangFormat = (_1: string, envType: number) => `
# AvZ 库的代码风格 (在格式化时使用)
BasedOnStyle: WebKit
AlignTrailingComments: true
Cpp11BracedListStyle: true
BreakBeforeBraces: Attach
BreakConstructorInitializersBeforeComma: true
SpaceInEmptyBlock: false
${envType === 1 ? "" : `
Macros:
  - 'At(x)=_='
  - 'Do=[]'
  - 'CoDo=[]'`.trimStart()}
`.trimStart();

const FLAGS_AVZ1 = "-std=c++1z -Wno-sign-compare";
const FLAGS_AVZ2 = "-m32 -static -std=c++2b -fexperimental-library -Werror=return-type -Werror=unused-result";

export function generateMetadataJson(_: string, envType: number): string {
    const flag1 = envType === 1 ? FLAGS_AVZ1 : FLAGS_AVZ2;
    const flag2 = envType === 1 ? "" : "-ldbghelp";
    return JSON.stringify({
        compileOptions: `${flag1} __CUSTOM_ARGS__ "__FILE_NAME__" -isystem "__AVZ_DIR__/inc" -lavz -lgdi32 ${flag2} -L "__AVZ_DIR__/bin" -shared -o "bin/libavz.dll"`
    }, null, 4);
}

export function getAvzCompileCommand(avzDir: string, envType: number): string {
    const flag = envType === 1 ? FLAGS_AVZ1 : FLAGS_AVZ2;
    return `set "PATH=${avzDir}/MinGW/bin;%PATH%" && "${avzDir}/MinGW/bin/g++" ${flag} __CUSTOM_ARGS__ -c "__FILE_NAME__" -isystem "${avzDir}/inc" -o "__FILE_NAME__.o"`;
}

export const getAvzPackCommand = (avzDir: string) => `for /r "${avzDir}/src" %f in (*.o) do @"${avzDir}/MinGW/bin/ar" -rcs "${avzDir}/bin/libavz.a" "%f" && @del "%f"`;
