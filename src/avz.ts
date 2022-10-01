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
import { execSync } from 'child_process';
import internal = require('stream');


export class Avz {
    private avzTerminal: vscode.Terminal | undefined;
    private giteeDepositoryUrl: string;
    private avzVersionTxtName: string;
    private avzVersionTxtUrl: string;
    private workspaceRoot: readonly vscode.WorkspaceFolder[] | undefined;
    private runScriptCmd: string;
    private fileManager: FileManager;
    private avzDir: string;
    private pvzProcessPid: string;
    private pvzExePath: string;
    private pvzExeName: string;

    constructor() {
        this.avzTerminal = undefined;
        this.giteeDepositoryUrl = "https://gitee.com/vector-wlc/AsmVsZombies/raw/master/release/";
        this.avzVersionTxtName = "version.txt";
        this.avzVersionTxtUrl = this.giteeDepositoryUrl + this.avzVersionTxtName;
        this.workspaceRoot = vscode.workspace.workspaceFolders;
        this.runScriptCmd = "";
        this.fileManager = new FileManager;
        this.avzDir = "";
        this.pvzProcessPid = "";
        this.pvzExePath = "";
        this.pvzExeName = "PlantsVsZombies.exe";

        vscode.window.terminals.forEach(terminal => {
            if (terminal.name === "AvZ") {
                this.avzTerminal = terminal;
                return;
            }
        });

    }

    private setRunScriptCmd() {
        const str = vscode.workspace.getConfiguration().get('avzConfigure.avzCompilerCmd');
        let avzCompilerCmd: string;
        if (str) {
            avzCompilerCmd = <string>str;
        } else {
            avzCompilerCmd = template_strs.COMPILER_CMD;
            vscode.workspace.getConfiguration().update('avzConfigure.avzRunScriptCmd', this.runScriptCmd, true);
        }
        const result = vscode.workspace.getConfiguration().get('avzConfigure.avzRunScriptCmd');
        if (result) {
            this.runScriptCmd = <string>result;
        } else {
            this.runScriptCmd = template_strs.RUN_SCRIPT_CMD;
            vscode.workspace.getConfiguration().update('avzConfigure.avzRunScriptCmd', this.runScriptCmd, true);
        }
        this.runScriptCmd = this.fileManager.strReplaceAll(this.runScriptCmd, "__COMPILER_CMD__", avzCompilerCmd);
        this.runScriptCmd = this.fileManager.strReplaceAll(this.runScriptCmd, "__AVZ_DIR__", this.avzDir);
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
        let launchJsonFile = this.fileManager.strReplaceAll(template_strs.LAUNCH_JSON, "__AVZ_DIR__", this.avzDir);
        this.fileManager.mkDir(projectDir + "/.vscode");
        this.fileManager.mkDir(projectDir + "/bin");
        this.fileManager.writeFile(projectDir + "/.vscode/c_cpp_properties.json", cCppJsonFile, false);
        this.fileManager.writeFile(projectDir + "/.vscode/settings.json", template_strs.SETTINGS_JSON, false);
        this.fileManager.writeFile(projectDir + "/.vscode/tasks.json", template_strs.TASKS_JSON, false);
        this.fileManager.writeFile(projectDir + "/.vscode/launch.json", launchJsonFile, false);
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

        vscode.window.showErrorMessage("未找到 AvZ 安装目录，请重新尝试运行命令: AvZ : Set AvZ Dir");
    }

    public runCmd(cmd: string) {
        if (this.avzTerminal === undefined) {
            this.avzTerminal = vscode.window.createTerminal("AvZ", "cmd");
        }
        this.avzTerminal.sendText(cmd);
        this.avzTerminal.show();
    }

    private killGdb32() {

        try {
            execSync("taskkill /F /IM gdb32.exe");
        } catch (e) {

        }
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
                // 把调试进程强制杀掉
                this.killGdb32();
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

    public getPvzExePath(): string {
        // 得到 pvzExeName
        const result = vscode.workspace.getConfiguration().get('avzConfigure.pvzExeName');
        if (result) {
            this.pvzExeName = <string>result;
        } else {
            vscode.workspace.getConfiguration().update('avzConfigure.pvzExeName', this.pvzExeName, true);
        }

        // 寻找 Path
        let output = execSync("wmic process where name=\"" + this.pvzExeName + "\" get ExecutablePath").toString();
        let pvzExePathList = output.split("\n");
        if (pvzExePathList[1].indexOf('PlantsVsZombies.exe') >= 0) {
            let pvzExePath = pvzExePathList[1].trim();
            return pvzExePath;
        }

        return "PvZ is not activated!";
    }

    public getPvzProcessId(): string {

        // 得到 pvzExeName
        const result = vscode.workspace.getConfiguration().get('avzConfigure.pvzExeName');
        if (result) {
            this.pvzExeName = <string>result;
        } else {
            vscode.workspace.getConfiguration().update('avzConfigure.pvzExeName', this.pvzExeName, true);
        }

        // 寻找 PID
        let output = execSync("tasklist |find /i \"" + this.pvzExeName + "\"").toString();
        let p = output.trim().split(/\s+/);
        let pname = p[0];
        let pid = p[1];
        if (pname.indexOf('PlantsVsZombies.exe') >= 0 && parseInt(pid)) {
            return pid;
        }

        return "PvZ is not activated!";
    }
}
