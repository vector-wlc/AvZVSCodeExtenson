/*
 * @Coding: utf-8
 * @Author: vector-wlc
 * @Date: 2021-09-29 23:37:28
 * @Description:
 */
import * as vscode from 'vscode';
import * as fs from "fs";
import * as http from "https"


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


    public downloadFile(url: string, dest: string, callback: Function): void {
        const file = fs.createWriteStream(dest);
        http.get(url, (res) => {
            if (res.statusCode !== 200) {
                vscode.window.showErrorMessage("下载文件 " + url + " 失败");
                return;
            }

            file.on('finish', () => {
                file.close();
                callback();
            }).on('error', (err) => {
                fs.unlinkSync(dest);
                vscode.window.showErrorMessage("下载文件 " + url + " 失败");
            })
            res.on('end', () => {
            });
            res.pipe(file);
        });
    }

}