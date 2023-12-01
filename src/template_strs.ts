/*
 * @Coding: utf-8
 * @Author: vector-wlc
 * @Date: 2021-09-30 11:29:40
 * @Description:
 */

export const C_CPP_JSON = `{
    "configurations": [{
        "name": "Windows",
        "includePath": [
            "__AVZ_DIR__/inc"
        ],
        "cStandard": "c11",
        "cppStandard": "c++20"
    }],
    "version": 4
}`;

export const SETTINGS_JSON = `{
    // 解注这条语句实现保存时格式化
    // "editor.formatOnSave": true, 
    
    // AvZ 库的代码格式化方式，也可在根目录创建 .clang-format 文件粘贴 { BasedOnStyle: WebKit, AlignTrailingComments: true, Cpp11BracedListStyle: true } 实现相同的功能
    // "C_Cpp.clang_format_fallbackStyle": "{ BasedOnStyle: WebKit, AlignTrailingComments: true, Cpp11BracedListStyle: true }", 

    // 解注这条语句关闭 Cpp 插件的报错提示
    // "C_Cpp.errorSquiggles": "disabled",

    // clangd avz 配置命令
    // 未安装 clangd vsc 扩展此配置无效
    "clangd.fallbackFlags": [
        "-I__AVZ_DIR__/inc",
        "-std=c++2b"
    ],
}`;

export const LAUNCH_JSON = `{
    "configurations": [
        {
            "name": "avz attach",
            "type": "cppdbg",
            "request": "attach",
            "processId": "\${command:pickProcess}",
            "program": "\${command:AsmVsZombies.getPvzExePath}",
            "MIMode": "gdb",
            "miDebuggerPath": "__AVZ_DIR__/MinGW/bin/gdb32.exe",
            "preLaunchTask": "avz"
        }
    ]
}`;

export const TASKS_JSON = `{
    "tasks": [
        {
            "type": "shell",
            "label": "avz",
            "command": "\${command:AsmVsZombies.runScript}",
        }
    ],
    "version": "2.0.0"
}`;
