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

export const generateMetadataJson = (_: string, envType: number) => `{
    "compileOptions": "${envType === 1 ? "-std=c++1z -Wno-sign-compare" : "-m32 -static -std=c++2b -fexperimental-library -Werror=return-type -Werror=unused-result"} __CUSTOM_ARGS__ \\"__FILE_NAME__\\" -isystem \\"__AVZ_DIR__/inc\\" -lavz ${envType === 1 ? "-lgdi32" : "-lgdi32 -ldbghelp"} -L \\"__AVZ_DIR__/bin\\" -shared -o \\"bin/libavz.dll\\""
}`;


export function generateCompileCmd(avzDir: string, envType: number): string {
    let cmd1 = `set "PATH=${avzDir}/MinGW/bin;%PATH%" && "${avzDir}/MinGW/bin/g++" `;
    let cmd2 = envType === 1 ? "-std=c++1z -Wno-sign-compare" : "-m32 -static -std=c++2b -fexperimental-library -Werror=return-type -Werror=unused-result ";
    let cmd3 = `__CUSTOM_ARGS__ -c "__FILE_NAME__" -isystem "${avzDir}/inc" -o "__FILE_NAME__.o"`;
    return cmd1 + cmd2 + cmd3;
}

export const generatePackCmd = (avzDir: string) => `set "PATH=${avzDir}/MinGW/bin;%PATH%" && ar -crs "${avzDir}/bin/libavz.a" ${avzDir}/src/*.o`
