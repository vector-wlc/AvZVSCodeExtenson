// Copyright (C) 2021-2025 AsmVsZombies Team
//
// This file is part of AvZ VSCode Extension.
//
// AvZ VSCode Extension is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by the
// Free Software Foundation, either version 3 of the License, or (at your
// option) any later version.
//
// AvZ VSCode Extension is distributed in the hope that it will be useful, but
// WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY
// or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for
// more details.
//
// You should have received a copy of the GNU General Public License along with
// AvZ VSCode Extension. If not, see <https://www.gnu.org/licenses/>.

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

    // 解注这条语句实现保存时格式化
    // "editor.formatOnSave": true,

    // AvZ 库的代码格式化方式 (Cpp 插件专用)
    // "C_Cpp.clang_format_fallbackStyle": "{ BasedOnStyle: WebKit, AlignTrailingComments: true, Cpp11BracedListStyle: true, BreakBeforeBraces: Attach, PackConstructorInitializers: NextLineOnly, SpaceInEmptyBlock: false }",

    // 解注这条语句关闭 Cpp 插件的报错提示
    // "C_Cpp.errorSquiggles": "disabled",

    // clangd 可执行文件路径
    // 未安装 clangd vsc 扩展此配置无效
    "clangd.path": "${avzDir}/MinGW/bin/clangd.exe",

    // clangd avz 配置命令
    // 未安装 clangd vsc 扩展此配置无效
    "clangd.fallbackFlags": [
        "-I${avzDir}/inc",
        "-m32",
        "-std=${envType === 1 ? "c++14" : "c++20"}",
        ${envType === 1 ? "" : '"-fexperimental-library"'}
    ],

    // lldb-dap avz lldb executable-path 配置
    // 未安装 lldb-dap 扩展此配置无效
    "lldb-dap.executable-path": "${avzDir}/MinGW/bin/lldb-vscode.exe"
}`;

export const generateLaunchJson = (avzDir: string, _: number) => `{
    "configurations": [
        // GDB 调试器
        // 一个基础可用的调试器，调试体验不如 LLDB，但无需安装其他插件
        // 开箱即用
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
        // LLDB 调试器
        // 注意 LLDB 能提供更好的调试体验（能显示 STL 的内存），但是使用此调试器时必须使用 32 位 AvZ2 环境包
        // 并且需要安装 vscode 插件 LLDB-DAP， 并在插件的 Lldb-dap: Executable-path 设置项上填写 [AvZ环境包的根目录]/MinGW/bin/lldb-vscode.exe
        {
            "name": "avz attach(lldb)",
            "type": "lldb-dap",
            "request": "attach",
            "program": "\${command:AsmVsZombies.getPvzExePath}",
            "preLaunchTask": "avz",
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

export const generateClangFormat = (_1: string, _2: number) => `
# AvZ 库的代码格式化方式
BasedOnStyle: WebKit
AlignTrailingComments: true
Cpp11BracedListStyle: true
BreakBeforeBraces: Attach
BreakConstructorInitializersBeforeComma: true
SpaceInEmptyBlock: false
`.trimStart();

export const generateMetadataJson = (_: string, envType: number) => `{
    "compileOptions": "${envType === 1 ? "-std=c++1z -Wno-sign-compare" : "-m32 -static -std=c++2b -fexperimental-library -Werror=return-type -Werror=unused-result"} __CUSTOM_ARGS__ \\"__FILE_NAME__\\" -isystem \\"__AVZ_DIR__/inc\\" -lavz ${envType === 1 ? "-lgdi32" : "-lgdi32 -ldbghelp"} -L \\"__AVZ_DIR__/bin\\" -shared -o \\"bin/libavz.dll\\""
}`;


export function generateCompileCmd(avzDir: string, envType: number): string {
    const cmd1 = `set "PATH=${avzDir}/MinGW/bin;%PATH%" && "${avzDir}/MinGW/bin/g++" `;
    const cmd2 = envType === 1 ? "-std=c++1z -Wno-sign-compare" : "-m32 -static -std=c++2b -fexperimental-library -Werror=return-type -Werror=unused-result ";
    const cmd3 = `__CUSTOM_ARGS__ -c "__FILE_NAME__" -isystem "${avzDir}/inc" -o "__FILE_NAME__.o"`;
    return cmd1 + cmd2 + cmd3;
}

export const generatePackCmd = (avzDir: string) => `set "PATH=${avzDir}/MinGW/bin;%PATH%" && ar -crs "${avzDir}/bin/libavz.a" ${avzDir}/src/*.o`;
