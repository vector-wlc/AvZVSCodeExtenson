/*
 * @Coding: utf-8
 * @Author: vector-wlc
 * @Date: 2021-09-30 11:29:40
 * @Description:
 */

export const RUN_SCRIPT_CMD = "set \"PATH=__AVZ_DIR__/MinGW/bin;%PATH%\" && \"__AVZ_DIR__/MinGW/bin/g++\" __COMPILER_CMD__  &&  \"__AVZ_DIR__/bin/injector.exe\"";

export const COMPILER_CMD = "-m32 -static -std=c++20 -g -Wall -Werror=return-type \"__FILE_NAME__\" -I \"__AVZ_DIR__/inc\" -lavz -lgdi32 -ldbghelp -L \"__AVZ_DIR__/bin\" -shared -o \"./bin/libavz.dll\"";

export const C_CPP_JSON = "{\n\
    \"configurations\": [{\n\
        \"name\": \"Windows\",\n\
        \"includePath\": [\n\
            \"__AVZ_DIR__/inc\"\n\
        ],\n\
        \"cStandard\": \"c11\",\n\
        \"cppStandard\": \"c++17\"\n\
    }],\n\
    \"version\": 4\n\
}";

export const SETTINGS_JSON = "{\n\
    \"editor.formatOnSave\": true,\n\
    \"C_Cpp.clang_format_fallbackStyle\": \"{ BasedOnStyle: WebKit, AlignTrailingComments: true, Cpp11BracedListStyle: true}\",\n\
    \"C_Cpp.errorSquiggles\": \"Disabled\"\n\
}";

export const LAUNCH_JSON = "{\n\
    \"configurations\": [\n\
        {\n\
            \"name\": \"(gdb) attach\",\n\
            \"type\": \"cppdbg\",\n\
            \"request\": \"attach\",\n\
            \"processId\": \"${command:AsmVsZombies.getPvzProcessId}\",\n\
            \"program\": \"${command:AsmVsZombies.getPvzExePath}\",\n\
            \"args\": [],\n\
            \"stopAtEntry\": false,\n\
            \"cwd\": \"${workspaceFolder}\",\n\
            \"environment\": [],\n\
            \"externalConsole\": false,\n\
            \"MIMode\": \"gdb\",\n\
            \"miDebuggerPath\": \"__AVZ_DIR__/MinGW/bin/gdb32.exe\",\n\
            \"setupCommands\": [\n\
                {\n\
                    \"description\": \"Enable pretty-printing for gdb\",\n\
                    \"text\": \"-enable-pretty-printing\",\n\
                    \"ignoreFailures\": true\n\
                }\n\
            ],\n\
            \"preLaunchTask\": \"avz\"\n\
        }\n\
    ]\n\
}";

export const TASKS_JSON = "{\n\
    \"tasks\": [\n\
        {\n\
            \"type\": \"shell\",\n\
            \"label\": \"avz\",\n\
            \"command\": \"${command:AsmVsZombies.runScript}\",\n\
        }\n\
    ],\n\
    \"version\": \"2.0.0\"\n\
}";