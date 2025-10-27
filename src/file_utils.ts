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
import { pipeline } from 'stream';
import * as vscode from 'vscode';

export function mkdir(dirName: string): void {
    fs.mkdirSync(dirName, { recursive: true });
}

export const readFileLines = (path: string): string[] => fs.readFileSync(path, "utf8").trimEnd().replaceAll("\r", "").split("\n");

export function writeFile(path: string, str: string, canOverwrite: boolean = true): void {
    try {
        fs.writeFileSync(path, str, { flag: canOverwrite ? "w" : "wx" });
    } catch (err) {
        if (canOverwrite || ((err as NodeJS.ErrnoException).code !== "EEXIST")) {
            throw err;
        }
    }
}

export function downloadFile(srcUrl: string, destPath: string, showProgress: boolean = false): Thenable<void> {
    const showErrorMessage = (error: string) => {
        vscode.window.showErrorMessage(vscode.l10n.t("Failed to download file \"{url}\". ({error})", { url: srcUrl, error: error }));
    };

    const download = (progress?: vscode.Progress<{
        message?: string;
        increment?: number;
    }>) => new Promise<void>(callback => {
        https.get(srcUrl, (res) => {
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
            let file = fs.createWriteStream(destPath).on("finish", () => { callback(); });
            pipeline(res, file, (err) => {
                if (err !== null) {
                    showErrorMessage(err.message);
                    if (fs.existsSync(destPath)) {
                        fs.unlinkSync(destPath);
                    }
                }
            });
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

export const downloadToPick = (
    srcUrl: string,
    destPath: string,
    title: string,
    pred?: (option: string) => boolean // 用于过滤选项的谓词
) => new Promise<string>(callback => {
    downloadFile(srcUrl, destPath).then(() => {
        const options = readFileLines(destPath).filter(pred ?? (() => true));
        if (options.length === 0) {
            return;
        }
        vscode.window.showQuickPick(options, { title: title }).then(selection => {
            if (selection) {
                callback(selection);
            }
        });
    });
});
