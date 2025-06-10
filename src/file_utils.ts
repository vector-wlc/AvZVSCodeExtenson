// Copyright (C) 2021-2025 AsmVsZombies Team
//
// This file is part of AvZ VSCode Extension.
//
// AvZ VSCode Extension is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by the
// Free Software Foundation, either version 3 of the License, or (at your
// option) any later version.
//
// AvZ VSCode Extension is distributed in the hope that it will be useful, but
// WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY
// or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for
// more details.
//
// You should have received a copy of the GNU General Public License along with
// AvZ VSCode Extension. If not, see <https://www.gnu.org/licenses/>.

import * as fs from 'fs';
import * as http from 'https';
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
    fs.writeFileSync(fileName, content, "utf8");
}


export const downloadFile = (url: string, dest: string) => new Promise<string>(callback => {
    const file = fs.createWriteStream(dest);
    const showErrorMessage = (error: string) => {
        vscode.window.showErrorMessage(vscode.l10n.t("Failed to download file \"{url}\". ({error})", { url: url, error: error }));
    };

    http.get(url, (res) => {
        if (res.statusCode !== 200) {
            showErrorMessage(`${res.statusCode} ${res.statusMessage}`);
            res.resume(); // 消费响应数据以清理内存
            return;
        }

        file.on("finish", () => {
            file.close();
            callback(dest);
        }).on("error", (err) => {
            if (fs.existsSync(dest)) {
                fs.unlinkSync(dest);
            }
            showErrorMessage(err.message);
        });

        res.pipe(file);

    }).on("error", (err) => {
        showErrorMessage(err.message);
    });
});


export const downloadToPick = (remote: string, local: string, title: string) => new Promise<string>(callback => {
    downloadFile(remote, local).then(localFile => {
        const list = readFile(localFile);
        if (list.length === 0) {
            return;
        }
        vscode.window.showQuickPick(list, { title: title }).then(str => {
            if (str !== undefined && str !== "") {
                callback(str);
            }
        });
    });
});
