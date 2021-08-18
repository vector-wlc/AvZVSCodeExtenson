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
		avz.setTerminalClosed();
	});

	let runScript = vscode.commands.registerCommand('AsmVsZombies.runScript', () => {
		avz.runScript();
	});

	let updateAvz = vscode.commands.registerCommand('AsmVsZombies.updateAvz', () => {
		avz.getAvzVersionList((avzVersionList: string[]) => {
			if (avzVersionList.length === 0) {
				return;
			}

			const options: vscode.QuickPickOptions = {
				title: "请选择 AvZ 版本"
			};
			vscode.window.showQuickPick(avzVersionList, options).then(avzVersion => {
				if (avzVersion && avzVersion.length !== 0) {
					avz.setAvzVerison(avzVersion);
				}
			});
		});
	});
	context.subscriptions.push(runScript);
	context.subscriptions.push(updateAvz);
	context.subscriptions.push(closeTerminal);
}

// this method is called when your extension is deactivated
export function deactivate() { }
