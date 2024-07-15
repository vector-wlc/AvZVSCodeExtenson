/*
 * @Coding: utf-8
 * @Author: vector-wlc
 * @Date: 2021-09-30 11:29:40
 * @Description:
 */

export const generateCCppJson = (avzDir: string, envType: number) => `{
    "configurations": [{
        "name": "Windows",
        "includePath": [
            "${avzDir}/inc"
        ],
        "cStandard": "c11",
        "cppStandard": "${envType === 1 ? "c++14" : "c++20"}"
    }],
    "version": 4
}`;

export const generateSettingsJson = (avzDir: string, envType: number) => `{
    // 解注这条语句实现保存时格式化
    // "editor.formatOnSave": true,

    // AvZ 库的代码格式化方式，也可在根目录创建 .clang-format 文件粘贴引号内的内容（不含引号）实现相同的功能
    // "C_Cpp.clang_format_fallbackStyle": "{ BasedOnStyle: WebKit, AlignTrailingComments: true, Cpp11BracedListStyle: true, BreakBeforeBraces: Attach, PackConstructorInitializers: NextLineOnly, SpaceInEmptyBlock: false }",

    // 解注这条语句关闭 Cpp 插件的报错提示
    // "C_Cpp.errorSquiggles": "disabled",

    // clangd avz 配置命令
    // 未安装 clangd vsc 扩展此配置无效
    "clangd.fallbackFlags": [
        "-I${avzDir}/inc",
        "-std=${envType === 1 ? "c++14" : "c++2b"}"
    ],
}`;

export const generateLaunchJson = (avzDir: string, _: number) => `{
    "configurations": [
        {
            "name": "avz attach",
            "type": "cppdbg",
            "request": "attach",
            "processId": "\${command:pickProcess}",
            "program": "\${command:AsmVsZombies.getPvzExePath}",
            "MIMode": "gdb",
            "miDebuggerPath": "${avzDir}/MinGW/bin/gdb32.exe",
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

export const generateMetadataJson = (_: string, envType: number) => `{
    "compileOptions": "${envType === 1 ? "-std=c++1z -Wno-sign-compare" : "-m32 -static -std=c++2b -fexperimental-library -Werror=return-type -Werror=unused-result"} __CUSTOM_ARGS__ \\"__FILE_NAME__\\" -isystem \\"__AVZ_DIR__/inc\\" -lavz ${envType === 1 ? "-lgdi32" : "-lgdi32 -ldbghelp"} -L \\"__AVZ_DIR__/bin\\" -shared -o \\"bin/libavz.dll\\""
}`;
