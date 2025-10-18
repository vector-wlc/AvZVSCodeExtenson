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

import * as fs from 'fs';
import * as https from 'https';
import * as vscode from 'vscode';

export function mkDir(dirName: string): boolean {
    if (fs.existsSync(dirName)) {
        return true;
    }
    fs.mkdirSync(dirName);
    return fs.existsSync(dirName);
}


export function readFile(fileName: string): string[] {
    let lines = fs.readFileSync(fileName, "utf8").replaceAll("\r", "").split("\n");
    while (lines.at(-1) === "") {
        lines.pop();
    }
    return lines;
}


export function writeFile(fileName: string, content: string, isUnlink: boolean = true): void {
    if (fs.existsSync(fileName)) {
        if (!isUnlink) {
            return;
        }
        fs.unlinkSync(fileName);
    }
    fs.writeFileSync(fileName, content);
}


export function downloadFile(url: string, dest: string, showProgress: boolean = false): Thenable<void> {
    const showErrorMessage = (error: string) => {
        vscode.window.showErrorMessage(vscode.l10n.t("Failed to download file \"{url}\". ({error})", { url: url, error: error }));
    };

    const download = (progress?: vscode.Progress<{
        message?: string;
        increment?: number;
    }>) => new Promise<void>(callback => {
        https.get(url, (res) => {
            if (res.statusCode !== 200) {
                showErrorMessage(`${res.statusCode} ${res.statusMessage}`);
                res.resume(); // 丢弃数据以减少内存占用
                return;
            }
            if (showProgress) {
                const total = Number(res.headers["content-length"] ?? "0");
                if (total > 0) {
                    let received = 0;
                    res.on("data", (chunk) => {
                        received += chunk.length;
                        const percent = (received / total) * 100;
                        progress!.report({
                            message: `${Math.round(percent)}%`,
                            increment: (chunk.length / total) * 100
                        });
                    });
                }
            }
            let file = fs.createWriteStream(dest)
                .on("finish", () => { callback(); })
                .on("error", (err) => { showErrorMessage(err.message); });
            res.pipe(file);
        }).on("error", (err) => { showErrorMessage(err.message); });
    });

    if (!showProgress) {
        return download();
    }
    return vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: vscode.l10n.t("Downloading"),
        cancellable: false
    }, download);
};


export const downloadToPick = (remote: string, local: string, title: string) => new Promise<string>(callback => {
    downloadFile(remote, local).then(() => {
        const list = readFile(local);
        if (list.length === 0) {
            return;
        }
        vscode.window.showQuickPick(list, { title: title }).then(str => {
            if (str) {
                callback(str);
            }
        });
    });
});
