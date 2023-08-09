/*
 * @Coding: utf-8
 * @Author: vector-wlc
 * @Date: 2021-09-29 23:37:28
 * @Description:
 */
import * as vscode from 'vscode';
import * as fs from "fs";
import * as http from "https";


export class FileManager {
    public mkDir(dirName: string): boolean {
        if (fs.existsSync(dirName)) {
            return true;
        }
        fs.mkdirSync(dirName);
        return fs.existsSync(dirName);
    }

    public writeFile(fileName: string, content: string, isUnlink: boolean = true): void {
        if (fs.existsSync(fileName)) {
            if (isUnlink) {
                fs.unlinkSync(fileName);
            } else {
                return;
            }
        }
        fs.writeFile(fileName, content, "utf-8", (err) => {
            if (err) {
                vscode.window.showErrorMessage("Write File : " + fileName + " Failed");
            }
        });
    }

    public strReplaceAll(str: string, subStr: string, newSubStr: string): string {
        return str.split(subStr).join(newSubStr);
    }


    public downloadFile(url: string, dest: string): Promise<string> {
        let promise = new Promise<string>(function (callback, reject) {
            const file = fs.createWriteStream(dest);
            http.get(url, (res) => {
                if (res.statusCode !== 200) {
                    vscode.window.showErrorMessage("下载文件 " + url + " 失败");
                    return;
                }

                file.on('finish', () => {
                    file.close();
                    callback(dest);
                }).on('error', (err) => {
                    fs.unlinkSync(dest);
                    vscode.window.showErrorMessage("下载文件 " + url + " 失败");
                });
                res.on('end', () => {
                });
                res.pipe(file);
            });
        });

        return promise;
    }


    public downloadToPick(remote: string, local: string, title: string): Promise<string> {
        let _this = this;
        let promise = new Promise<string>(function (callback, reject) {
            _this.downloadFile(remote, local).then(localFile => {
                let list = _this.readFile(localFile);
                if (list.length === 0) {
                    return;
                }
                const options: vscode.QuickPickOptions = {
                    title: title
                };
                vscode.window.showQuickPick(list, options).then(str => {
                    if (str && str.length !== 0) {
                        callback(str);
                    }
                });
            });
        });
        return promise;
    }

    public readFile(fileName: string): string[] {
        const str = fs.readFileSync(fileName, { encoding: 'utf8', flag: 'r' });
        let ret = this.strReplaceAll(str, "\r", "");
        let strList = ret.split("\n");
        while (strList[strList.length - 1] === "") {
            strList.pop();
        }
        return strList;
    }
}