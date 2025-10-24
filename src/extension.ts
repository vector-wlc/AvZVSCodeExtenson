/*
 * Copyright (C) 2021-2025 AsmVsZombies Team
 *
 * This file is part of AvZ VSCode Extension.
 *
 * AvZ VSCode Extension is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by the
 * Free Software Foundation, either version 3 of the License, or (at your
 * option) any later version.
 *
 * AvZ VSCode Extension is distributed in the hope that it will be useful, but
 * WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY
 * or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for
 * more details.
 *
 * You should have received a copy of the GNU General Public License along with
 * AvZ VSCode Extension. If not, see <https://www.gnu.org/licenses/>.
 */

import * as vscode from 'vscode';
import { Avz } from './avz';

let avz = new Avz();

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
    const closeTerminal = vscode.window.onDidCloseTerminal(terminal => {
        // Watch for when the server terminal closes.
        if (terminal.name === "AvZ") {
            avz.closeTerminal();
        }
    });


    const runScriptMaskCmd = vscode.commands.registerCommand("AsmVsZombies.runScript", () => {
        avz.runScriptMaskCmd();
    });

    const runScriptInTerminal = vscode.commands.registerCommand("AsmVsZombies.runScriptInTerminal", () => {
        avz.runScriptInTerminal();
    });

    const updateAvz = vscode.commands.registerCommand("AsmVsZombies.updateAvz", () => {
        avz.updateAvz();
    });

    const openAvzTutorial = vscode.commands.registerCommand("AsmVsZombies.openAvzTutorial", () => {
        vscode.env.openExternal(vscode.Uri.parse("https://gitee.com/vector-wlc/AsmVsZombies"));
    });

    const getPvzExePath = vscode.commands.registerCommand("AsmVsZombies.getPvzExePath", () => {
        return avz.getPvzExePath();
    });

    const getPvzProcessId = vscode.commands.registerCommand("AsmVsZombies.getPvzProcessId", () => {
        return avz.getPvzProcessId();
    });

    const setAvzDir = vscode.commands.registerCommand("AsmVsZombies.setAvzDir", () => {
        const options: vscode.OpenDialogOptions = {
            canSelectFolders: true,
            canSelectFiles: false,
            canSelectMany: false,
            openLabel: vscode.l10n.t("Open the AvZ installation directory")
        };
        vscode.window.showOpenDialog(options).then(urls => {
            if (urls && urls.length > 0) {
                avz.setAvzDir(urls[0].fsPath);
            }
        });
    });

    const downloadAvzExtension = vscode.commands.registerCommand("AsmVsZombies.downloadAvzExtension", () => {
        avz.fetchAvzExtension();
    });

    const buildAvz = vscode.commands.registerCommand("AsmVsZombies.buildAvz", () => {
        avz.buildAvz();
    });

    const showAvzInfo = vscode.commands.registerCommand("AsmVsZombies.showAvzInfo", () => {
        avz.showAvzInfo();
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
        downloadAvzExtension,
        buildAvz,
        showAvzInfo
    );
}

// this method is called when your extension is deactivated
export function deactivate() { }
