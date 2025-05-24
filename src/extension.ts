/*
 * @Coding: utf-8
 * @Author: vector-wlc
 * @Date: 2021-08-16 10:34:16
 * @Description:
 */

import * as vscode from 'vscode';
import { Avz } from './avz';

let avz = new Avz();

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	let closeTerminal = vscode.window.onDidCloseTerminal(t => {
		// Watch for when the server terminal closes.
		if (t.name === "AvZ") {
			avz.setTerminalClosed();
		}
	});

	let runScriptMaskCmd = vscode.commands.registerCommand('AsmVsZombies.runScript', () => {
		avz.runScriptMaskCmd();
	});

	let runScriptInTerminal = vscode.commands.registerCommand('AsmVsZombies.runScriptInTerminal', () => {
		avz.runScriptInTerminal();
	});

	let updateAvz = vscode.commands.registerCommand('AsmVsZombies.updateAvz', () => {
		avz.getAvzVersionList();
	});

	let openAvzTutorial = vscode.commands.registerCommand('AsmVsZombies.openAvzTutorial', () => {
		avz.runCmd("start https://gitee.com/vector-wlc/AsmVsZombies");
	});

	let getPvzExePath = vscode.commands.registerCommand('AsmVsZombies.getPvzExePath', () => {
		return avz.getPvzExePath();
	});

	let getPvzProcessId = vscode.commands.registerCommand('AsmVsZombies.getPvzProcessId', () => {
		return avz.getPvzProcessId();
	});

	let setAvzDir = vscode.commands.registerCommand('AsmVsZombies.setAvzDir', () => {
		const options: vscode.OpenDialogOptions = {
			canSelectFolders: true,
			canSelectFiles: false,
			canSelectMany: false,
			openLabel: vscode.l10n.t("Open the AvZ installation directory")
		};

		vscode.window.showOpenDialog(options).then(dir => {
			if (dir && dir[0]) {
				avz.setAvzDir(dir[0].fsPath);
			}
		});
	});

	let getAvZExtension = vscode.commands.registerCommand('AsmVsZombies.getAvZExtension', () => {
		return avz.getExtensionList();
	});


	let buildAvZ = vscode.commands.registerCommand('AsmVsZombies.buildAvZ', () => {
		return avz.build();
	});

	context.subscriptions.push(runScriptMaskCmd);
	context.subscriptions.push(runScriptInTerminal);
	context.subscriptions.push(updateAvz);
	context.subscriptions.push(closeTerminal);
	context.subscriptions.push(openAvzTutorial);
	context.subscriptions.push(setAvzDir);
	context.subscriptions.push(getPvzExePath);
	context.subscriptions.push(getPvzProcessId);
	context.subscriptions.push(getAvZExtension);
	context.subscriptions.push(buildAvZ);
}

// this method is called when your extension is deactivated
export function deactivate() { }
