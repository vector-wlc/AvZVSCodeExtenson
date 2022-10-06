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

export class Avz {
    private avzTerminal: vscode.Terminal | undefined = undefined;
    private giteeDepositoryUrl: string = "https://gitee.com/vector-wlc/AsmVsZombies/raw/master/release/";
    private avzVersionTxtName: string = "version.txt";
    private avzVersionTxtUrl: string = this.giteeDepositoryUrl + this.avzVersionTxtName;
    private workspaceRoot: readonly vscode.WorkspaceFolder[] | undefined = vscode.workspace.workspaceFolders;
    private runScriptCmd: string = "";
    private fileManager: FileManager = new FileManager;;
    private avzDir: string = "";
    private pvzExeName: string = "PlantsVsZombies.exe";
    private extensionGiteeDepositoryUrl: string = "https://gitee.com/qrmd/AvZLib/raw/main";
    private extensionName: string = "";
    private extensionVerisonName: string = "";
    private avzVerison: string = "";
    private extensionDownloadList: string[] = [];
    constructor() {
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

    public getAvzVersionList(): void {
        if (!this.isCanRun()) {
            return;
        }

        if (this.avzDir === "") {
            this.setAvzDir();
        }

        if (this.avzDir !== "") {
            let avzVersionTxtPath = this.avzDir + "/" + this.avzVersionTxtName;
            this.fileManager.downloadFile(this.avzVersionTxtUrl, avzVersionTxtPath).then(avzVersionTxtPath => { // 得到版本列表
                let avzVersionList = this.fileManager.readFile(avzVersionTxtPath);
                if (avzVersionList.length === 0) {
                    return;
                }

                const options: vscode.QuickPickOptions = {
                    title: "请选择 AvZ 版本"
                };
                vscode.window.showQuickPick(avzVersionList, options).then(avzVersion => { // 得到版本文件
                    if (avzVersion && avzVersion.length !== 0) {
                        let avzVersionUrl = this.giteeDepositoryUrl + avzVersion;
                        let avzFilePath = this.avzDir + "/" + "avz.zip";
                        this.fileManager.downloadFile(avzVersionUrl, avzFilePath).then(avzVersionTxtPath => {
                            execSync(this.avzDir + "/7z/7z.exe x " + this.avzDir + "/avz.zip -aoa -o" + this.avzDir);
                            vscode.window.showInformationMessage("AvZ 更新成功");
                        });
                    }
                });
            });
        }
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

    private getAvzVerison(__this: Avz): void {
        if (this.avzVerison !== "") {
            return;
        }
        const strList = __this.fileManager.readFile(__this.avzDir + "/inc/libavz.h");
        for (let index = 0; index < strList.length; index++) {
            const element = strList[index];
            if (element.indexOf("__AVZ_VERSION__") !== -1) {
                __this.avzVerison = element.split(" ")[2];
                __this.avzVerison = "20" + __this.avzVerison.substring(0, 2) + "_" + __this.avzVerison.substring(2, 4) + "_" + __this.avzVerison.substring(4, 6);
                break;
            }
        }
    }

    public getExtensionList(): void {
        if (!this.isCanRun()) {
            return;
        }

        if (this.avzDir === "") {
            this.setAvzDir();
        }

        let extensionListTxtName = "extension_list.txt";
        this.extensionDownloadList = [];

        let incDir = fs.readdirSync(this.avzDir + "/inc")
        for (let idx = 0; idx < incDir.length; ++idx) { // 读取已经安装的插件列表
            if (incDir[idx].indexOf(".h") === -1) {
                this.extensionDownloadList.push(incDir[idx]);
            }
        }

        if (this.avzDir !== "") {
            let extensionListRemotePath = this.extensionGiteeDepositoryUrl + "/" + extensionListTxtName;
            let extensionListLocalPath = this.avzDir + "/" + extensionListTxtName;
            this.fileManager.downloadToPick(extensionListRemotePath, extensionListLocalPath, "请选择插件").then(extensionName => {
                this.extensionName = extensionName;
                let versionTxtRemotePath = this.extensionGiteeDepositoryUrl + "/" + extensionName + "/version.txt";
                let versionTxtLocalPath = this.avzDir + "/version.txt";
                return this.fileManager.downloadToPick(versionTxtRemotePath, versionTxtLocalPath, "请选择版本");
            }).then(versionName => {
                this.extensionVerisonName = versionName;
                this.installExtension(this, true);
            })
        }
    }

    private installExtension(__this: Avz, isForceInstall: boolean = false): void {
        let isPush = true;
        // 已经下载过的插件不再进行下载
        for (let idx = 0; idx < __this.extensionDownloadList.length; ++idx) {
            if (__this.extensionName.indexOf(__this.extensionDownloadList[idx]) !== -1) {
                if (!isForceInstall) {
                    vscode.window.showWarningMessage("您已安装过插件: " + __this.extensionDownloadList[idx] +
                        ", 因此不再进行重复安装, 如果遇到版本兼容性问题, 请手动安装该插件的其他版本, 如果实在解决不了问题, 请联系插件作者.");
                    return;
                } else {
                    isPush = false;
                    break;
                }
            }
        }

        if (isPush) {
            __this.extensionDownloadList.push(__this.extensionName);
        }

        let extensionRemoteFile = __this.extensionGiteeDepositoryUrl + "/" + __this.extensionName + "/release/" + __this.extensionVerisonName + ".zip";
        let extensionLocalFile = __this.avzDir + "/inc/extension.zip";
        __this.fileManager.downloadFile(extensionRemoteFile, extensionLocalFile).then(file => {
            execSync(__this.avzDir + "/7z/7z.exe x " + __this.avzDir + "/inc/extension.zip -aoa -o" + __this.avzDir + "/inc");
            // 读取插件的依赖列表
            let extensionName = __this.extensionName.split("/")[1];
            const strList = __this.fileManager.readFile(__this.avzDir + "/inc/" + extensionName + "/information.txt");
            for (let idx = 0; idx < strList.length; ++idx) {
                if (idx == 1) { // AvZ Version
                    __this.getAvzVerison(__this);
                    let needAvzVerison = strList[idx].split(" ")[1];
                    if (needAvzVerison !== __this.avzVerison) {
                        vscode.window.showWarningMessage("您下载的插件 " + extensionName + " 依赖的 AvZ 版本为 " + needAvzVerison +
                            ", 但是现在的 AvZ 版本为 " + __this.avzVerison + ", 这可能带来不兼容问题!");
                    }
                } else if (idx > 1) {
                    let tempList = strList[idx].split(" ");
                    __this.extensionName = tempList[0];
                    __this.extensionVerisonName = tempList[1];
                    __this.installExtension(__this);
                }
            }
            vscode.window.showInformationMessage("插件: " + __this.extensionName + " 安装结束");
        });
    }
}