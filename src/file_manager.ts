/*
 * @Coding: utf-8
 * @Author: vector-wlc
 * @Date: 2021-09-29 23:37:28
 * @Description:
 */

import * as fs from 'fs';
import * as http from 'https';
import * as vscode from 'vscode';

export class FileManager {
    public static strReplaceAll(str: string, subStr: string, newSubStr: string): string {
        return str.split(subStr).join(newSubStr);
    }


    public mkDir(dirName: string): boolean {
        if (fs.existsSync(dirName)) {
            return true;
        }
        fs.mkdirSync(dirName);
        return fs.existsSync(dirName);
    }


    public readFile(fileName: string): string[] {
        const str = fs.readFileSync(fileName, "utf8");
        const ret = FileManager.strReplaceAll(str, "\r", "");
        let lines = ret.split("\n");
        while (lines.length > 0 && lines[lines.length - 1] === "") {
            lines.pop();
        }
        return lines;
    }


    public writeFile(fileName: string, content: string, isUnlink: boolean = true): void {
        if (fs.existsSync(fileName)) {
            if (!isUnlink) {
                return;
            }
            fs.unlinkSync(fileName);
        }
        fs.writeFileSync(fileName, content, "utf8");
    }


    public downloadFile(url: string, dest: string): Promise<string> {
        return new Promise<string>(callback => {
            const file = fs.createWriteStream(dest);
            http.get(url, (res) => {
                if (res.statusCode !== 200) {
                    vscode.window.showErrorMessage(vscode.l10n.t("Failed to download file \"{0}\".", url));
                    return;
                }

                file.on("finish", () => {
                    file.close();
                    callback(dest);
                }).on("error", (err) => {
                    fs.unlinkSync(dest);
                    vscode.window.showErrorMessage(vscode.l10n.t("Failed to download file \"{0}\".", url) + ` (${err})`);
                });
                res.pipe(file);
            });
        });
    }


    public downloadToPick(remote: string, local: string, title: string): Promise<string> {
        return new Promise<string>(callback => {
            this.downloadFile(remote, local).then(localFile => {
                const list = this.readFile(localFile);
                if (list.length === 0) {
                    return;
                }
                vscode.window.showQuickPick(list, { title: title }).then(str => {
                    if (str && str.length !== 0) {
                        callback(str);
                    }
                });
            });
        });
    }
}
