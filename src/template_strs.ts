/*
 * @Coding: utf-8
 * @Author: vector-wlc
 * @Date: 2021-09-30 11:29:40
 * @Description:
 */

export const RUN_SCRIPT_CMD = "set PATH= __AVZ_DIR__/MinGW/bin; %PATH% && \
__AVZ_DIR__/MinGW/bin/g++ \
__FILE_NAME__ -std=c++1z -I __AVZ_DIR__/inc -l avz -L __AVZ_DIR__/bin -shared -o ./bin/libavz.dll && \
__AVZ_DIR__/bin/injector.exe"

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
}"

export const SETTINGS_JSON = "{\n\
    \"editor.formatOnSave\": true,\n\
    \"C_Cpp.clang_format_fallbackStyle\": \"{ BasedOnStyle: WebKit, AlignTrailingComments: true, Cpp11BracedListStyle: true}\",\n\
}"