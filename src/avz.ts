/*
 * @Coding: utf-8
 * @Author: vector-wlc
 * @Date: 2021-08-18 13:59:24
 * @Description:
 */
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as http from "https"

export class Avz {
    private avzTerminal: vscode.Terminal | undefined;
    private giteeDepositoryUrl: string;
    private avzVersionTxtName: string;
    private avzVersionTxtUrl: string;
    private workspaceRoot: readonly vscode.WorkspaceFolder[] | undefined;
    private runScriptCmd: string;

    constructor() {
        this.avzTerminal = undefined;
        this.giteeDepositoryUrl = "https://gitee.com/vector-wlc/AsmVsZombies/raw/master/release/";
        this.avzVersionTxtName = "version.txt";
        this.avzVersionTxtUrl = this.giteeDepositoryUrl + this.avzVersionTxtName;
        this.workspaceRoot = vscode.workspace.workspaceFolders;
        this.runScriptCmd = "";
        this.setRunScriptCmd();

    }

    private setRunScriptCmd() {
        if (this.workspaceRoot) {
            let workspaceRootPath = this.workspaceRoot[0].uri.fsPath;
            // 设置环境变量
            this.runScriptCmd = "set PATH=" + workspaceRootPath + "/MinGW/bin; %PATH% && ";

            // 运行编译命令
            this.runScriptCmd += workspaceRootPath + "/MinGW/bin/g++ ";
            this.runScriptCmd += "__FILE_NAME__ ";
            this.runScriptCmd += " -std=c++1z ";
            this.runScriptCmd += "-I ";
            this.runScriptCmd += workspaceRootPath + "/inc ";
            this.runScriptCmd += "-l ";
            this.runScriptCmd += "avz ";
            this.runScriptCmd += "-L ";
            this.runScriptCmd += workspaceRootPath + "/bin ";
            this.runScriptCmd += "-shared ";
            this.runScriptCmd += "-o ";
            this.runScriptCmd += workspaceRootPath + "/bin/libavz.dll && ";

            // 注入
            this.runScriptCmd += workspaceRootPath + "/bin/injector.exe";
        }
    }

    private isCanRun(): boolean {
        if (!this.workspaceRoot) {
            this.workspaceRoot = vscode.workspace.workspaceFolders; // 再次检查有没有打开文件夹
            if (!this.workspaceRoot) {
                vscode.window.showErrorMessage("您未打开文件夹，无法执行 AvZ 命令");
                return false;
            }
        }

        return true;
    }

    private runAvzCmd(cmd: string) {
        if (this.avzTerminal === undefined) {
            this.avzTerminal = vscode.window.createTerminal("AvZ", "cmd");
        }
        this.avzTerminal.sendText(cmd);
        this.avzTerminal.show();
    }

    public runScript() {
        if (this.isCanRun()) {
            this.setRunScriptCmd();
        }

        if (vscode.window.activeTextEditor) {
            let fileName = vscode.window.activeTextEditor.document.fileName;
            this.runAvzCmd(this.runScriptCmd.replace("__FILE_NAME__", fileName));
        }
    }

    public setTerminalClosed() {
        this.avzTerminal = undefined;
    }

    private downloadFile(url: string, dest: string, callback: Function): void {
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

    public getAvzVersionList(callback: Function): void {
        if (!this.isCanRun()) {
            return;
        }
        let avzVersionTxtPath = this.workspaceRoot![0].uri.fsPath + "/" + this.avzVersionTxtName;
        this.downloadFile(this.avzVersionTxtUrl, avzVersionTxtPath, () => {
            const str = fs.readFileSync(avzVersionTxtPath, { encoding: 'utf8', flag: 'r' });
            let avzVersionList = str.split("\n");
            callback(avzVersionList);
        })
    }

    public setAvzVerison(avzVersion: string): void {
        let avzVersionUrl = this.giteeDepositoryUrl + avzVersion;
        let avzFilePath = this.workspaceRoot![0].uri.fsPath + "/" + "avz.zip";
        this.downloadFile(avzVersionUrl, avzFilePath, () => {
            this.runAvzCmd("7z\\7z.exe x avz.zip -aoa");
        });
    }
}
