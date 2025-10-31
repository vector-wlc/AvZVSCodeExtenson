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

export function mkdir(path: string): void {
    fs.mkdirSync(path, { recursive: true });
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
    const download = (progress?: vscode.Progress<{
        message?: string;
        increment?: number;
    }>) => new Promise<void>((resolve, reject) => {
        https.get(srcUrl, (res) => {
            if (res.statusCode !== 200) {
                reject(new Error(`${res.statusCode} ${res.statusMessage}`));
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
            pipeline(res, fs.createWriteStream(destPath), (err) => {
                if (!err) {
                    resolve();
                    return;
                }
                try {
                    fs.unlinkSync(destPath);
                } finally {
                    reject(err);
                }
            });
        }).on("error", (err) => { reject(err); });
    });

    if (!showProgress) {
        return download();
    }
    return vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: vscode.l10n.t("Downloading"),
        cancellable: false
    }, download);
}

export async function downloadToPick(
    srcUrl: string,
    destPath: string,
    title: string,
    pred?: (option: string) => boolean // 用于过滤选项的谓词
): Promise<string | undefined> {
    await downloadFile(srcUrl, destPath);
    const options = readFileLines(destPath).filter(pred ?? (() => true));
    if (options.length === 0) {
        throw new Error("No valid options to select");
    }
    return vscode.window.showQuickPick(options, { title: title });
}
