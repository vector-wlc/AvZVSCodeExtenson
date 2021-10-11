/*
 * @Coding: utf-8
 * @Author: vector-wlc
 * @Date: 2021-08-18 13:59:24
 * @Description:
 */
import * as vscode from 'vscode';
import * as fs from 'fs';
import { FileManager } from './file_manager';
import * as template_strs from "./template_strs";


export class Avz {
    private avzTerminal: vscode.Terminal | undefined;
    private giteeDepositoryUrl: string;
    private avzVersionTxtName: string;
    private avzVersionTxtUrl: string;
    private workspaceRoot: readonly vscode.WorkspaceFolder[] | undefined;
    private runScriptCmd: string;
    private fileManager: FileManager;
    private avzDir: string;

    constructor() {
        this.avzTerminal = undefined;
        this.giteeDepositoryUrl = "https://gitee.com/vector-wlc/AsmVsZombies/raw/master/release/";
        this.avzVersionTxtName = "version.txt";
        this.avzVersionTxtUrl = this.giteeDepositoryUrl + this.avzVersionTxtName;
        this.workspaceRoot = vscode.workspace.workspaceFolders;
        this.runScriptCmd = "";
        this.fileManager = new FileManager;
        this.avzDir = "";
    }

    private setRunScriptCmd() {
        this.runScriptCmd = this.fileManager.strReplaceAll(template_strs.RUN_SCRIPT_CMD, "__AVZ_DIR__", this.avzDir);
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

    private createAvzFiles() {
        let projectDir = vscode.workspace.workspaceFolders![0].uri.fsPath;
        let cCppJsonFile = this.fileManager.strReplaceAll(template_strs.C_CPP_JSON, "__AVZ_DIR__", this.avzDir);
        this.fileManager.mkDir(projectDir + "/.vscode");
        this.fileManager.mkDir(projectDir + "/bin");
        this.fileManager.writeFile(projectDir + "/.vscode/c_cpp_properties.json", cCppJsonFile);
        this.fileManager.writeFile(projectDir + "/.vscode/settings.json", template_strs.SETTINGS_JSON);
    }

    public setAvzDir(avzDir: string = ""): void {
        if (!this.isCanRun()) {
            return;
        }
        if (avzDir === "") {
            const result = vscode.workspace.getConfiguration().get('avzConfigure.avzDir');
            if (result) {
                avzDir = <string>result;
            } else {
                avzDir = this.workspaceRoot![0].uri.fsPath;
            }
        }

        avzDir = this.fileManager.strReplaceAll(avzDir, "\\", "/");
        let one_dirs = fs.readdirSync(avzDir);
        for (let one_dir of one_dirs) {
            if (one_dir.search("AsmVsZombies") !== -1) { // 找到 AsmVsZombies 文件夹
                let two_dirs = fs.readdirSync(avzDir + "/" + one_dir);
                for (let two_dir of two_dirs) {
                    if (two_dir.search("MinGW") !== -1 || two_dir.search("inc") !== -1) { // 确定 AsmVsZombies 子目录
                        this.avzDir = avzDir + "/" + one_dir;
                        vscode.window.showInformationMessage("已找到 AvZ 安装目录 : " + this.avzDir);
                        vscode.workspace.getConfiguration().update('avzConfigure.avzDir', this.avzDir, true);
                        this.createAvzFiles();
                        return;
                    }
                }
            }

            if (one_dir.search("MinGW") !== -1 || one_dir.search("inc") !== -1) { // 确定 AsmVsZombies 子目录
                this.avzDir = avzDir;
                vscode.window.showInformationMessage("已找到 AvZ 安装目录 : " + this.avzDir);
                vscode.workspace.getConfiguration().update('avzConfigure.avzDir', this.avzDir, true);
                this.createAvzFiles();
                return;
            }
        }

        vscode.window.showErrorMessage("未找到 AvZ 安装目录，请重新尝试运行命令： AvZ : Set AvZ Dir");
    }

    public runCmd(cmd: string) {
        if (this.avzTerminal === undefined) {
            this.avzTerminal = vscode.window.createTerminal("AvZ", "cmd");
        }
        this.avzTerminal.sendText(cmd);
        this.avzTerminal.show();
    }

    public runScript() {
        if (!this.isCanRun()) {
            return;
        }

        if (this.avzDir === "") {
            this.setAvzDir();

        }

        if (this.avzDir !== "") {
            this.setRunScriptCmd();
            if (vscode.window.activeTextEditor) {
                vscode.window.activeTextEditor.document.save();
                let fileName = vscode.window.activeTextEditor.document.fileName;
                this.runCmd(this.runScriptCmd.replace("__FILE_NAME__", fileName));
            }
        }
    }

    public setTerminalClosed() {
        this.avzTerminal = undefined;
    }

    public getAvzVersionList(callback: Function): void {
        if (!this.isCanRun()) {
            return;
        }

        if (this.avzDir === "") {
            this.setAvzDir();
        }

        if (this.avzDir !== "") {
            let avzVersionTxtPath = this.avzDir + "/" + this.avzVersionTxtName;
            this.fileManager.downloadFile(this.avzVersionTxtUrl, avzVersionTxtPath, () => {
                const str = fs.readFileSync(avzVersionTxtPath, { encoding: 'utf8', flag: 'r' });
                let avzVersionList = str.split("\n");
                callback(avzVersionList);
            });
        }
    }

    public setAvzVerison(avzVersion: string): void {
        let avzVersionUrl = this.giteeDepositoryUrl + avzVersion;
        let avzFilePath = this.avzDir + "/" + "avz.zip";
        this.fileManager.downloadFile(avzVersionUrl, avzFilePath, () => {
            this.runCmd(this.avzDir + "/7z/7z.exe x " + this.avzDir + "/avz.zip -aoa -o" + this.avzDir);
        });
    }
}
