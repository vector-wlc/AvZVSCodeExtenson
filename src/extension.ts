/*
 * @Coding: utf-8
 * @Author: vector-wlc
 * @Date: 2021-08-16 10:34:16
 * @Description: 
 */

import * as vscode from 'vscode';

var terminal: vscode.Terminal | undefined;

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	let close_terminal = vscode.window.onDidCloseTerminal(t => {
		// Watch for when the server terminal closes.
		if (t.name === "AvZ") {
			terminal = undefined;
		}
	});

	let disposable = vscode.commands.registerCommand('AsmVsZombies.runScript', () => {
		if (vscode.window.activeTextEditor) {
			var file_name = vscode.window.activeTextEditor.document.fileName;
			var workspace_root = vscode.workspace.rootPath
			if (terminal === undefined) {
				terminal = vscode.window.createTerminal("AvZ", "cmd");
			}
			// 添加环境变量
			var cmd = "set PATH=" + workspace_root + "/MinGW/bin; %PATH% && ";

			// 运行编译命令
			cmd += workspace_root + "/MinGW/bin/g++ ";
			cmd += file_name;
			cmd += " -std=c++1z ";
			cmd += "-I ";
			cmd += workspace_root + "/inc ";
			cmd += "-l ";
			cmd += "avz ";
			cmd += "-L ";
			cmd += workspace_root + "/bin ";
			cmd += "-shared ";
			cmd += "-o ";
			cmd += workspace_root + "/bin/libavz.dll && ";

			// 注入
			cmd += workspace_root + "/bin/injector.exe";

			terminal.sendText(cmd);
			terminal.show();

		}
	});

	context.subscriptions.push(disposable);
	context.subscriptions.push(close_terminal);
}

// this method is called when your extension is deactivated
export function deactivate() { }
