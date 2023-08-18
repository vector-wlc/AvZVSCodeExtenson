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
    "editor.formatOnSave": true,
    "C_Cpp.clang_format_fallbackStyle": "{ BasedOnStyle: WebKit, AlignTrailingComments: true, Cpp11BracedListStyle: true }",
    "C_Cpp.errorSquiggles": "Disabled"
}`;

export const LAUNCH_JSON = `{
    "configurations": [
        {
            "name": "(gdb) attach",
            "type": "cppdbg",
            "request": "attach",
            "processId": "\${command:AsmVsZombies.getPvzProcessId}",
            "program": "\${command:AsmVsZombies.getPvzExePath}",
            "args": [],
            "stopAtEntry": false,
            "cwd": "\${workspaceFolder}",
            "environment": [],
            "externalConsole": false,
            "MIMode": "gdb",
            "miDebuggerPath": "__AVZ_DIR__/MinGW/bin/gdb32.exe",
            "setupCommands": [
                {
                    "description": "Enable pretty-printing for gdb",
                    "text": "-enable-pretty-printing",
                    "ignoreFailures": true
                }
            ],
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
