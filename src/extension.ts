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
	const closeTerminal = vscode.window.onDidCloseTerminal(t => {
		// Watch for when the server terminal closes.
		if (t.name === "AvZ") {
			avz.setTerminalClosed();
		}
	});

	const runScriptMaskCmd = vscode.commands.registerCommand('AsmVsZombies.runScript', () => {
		avz.runScriptMaskCmd();
	});

	const runScriptInTerminal = vscode.commands.registerCommand('AsmVsZombies.runScriptInTerminal', () => {
		avz.runScriptInTerminal();
	});

	const updateAvz = vscode.commands.registerCommand('AsmVsZombies.updateAvz', () => {
		avz.getAvzVersionList();
	});

	const openAvzTutorial = vscode.commands.registerCommand('AsmVsZombies.openAvzTutorial', () => {
		avz.runCmd("start https://gitee.com/vector-wlc/AsmVsZombies");
	});

	const getPvzExePath = vscode.commands.registerCommand('AsmVsZombies.getPvzExePath', () => {
		return avz.getPvzExePath();
	});

	const getPvzProcessId = vscode.commands.registerCommand('AsmVsZombies.getPvzProcessId', () => {
		return avz.getPvzProcessId();
	});

	const setAvzDir = vscode.commands.registerCommand('AsmVsZombies.setAvzDir', () => {
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

	const getAvZExtension = vscode.commands.registerCommand('AsmVsZombies.getAvZExtension', () => {
		avz.getExtensionList();
	});

	const buildAvZ = vscode.commands.registerCommand('AsmVsZombies.buildAvZ', () => {
		avz.build();
	});

	context.subscriptions.push(
		runScriptMaskCmd,
		runScriptInTerminal,
		updateAvz,
		closeTerminal,
		openAvzTutorial,
		setAvzDir,
		getPvzExePath,
		getPvzProcessId,
		getAvZExtension,
		buildAvZ
	);
}

// this method is called when your extension is deactivated
export function deactivate() { }
