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
    private avzRepositoryUrl: Map<string, string> = new Map([
        ["GitHub", "https://github.com/vector-wlc/AsmVsZombies/raw/master"],
        ["GitLab", "https://gitlab.com/vector-wlc/AsmVsZombies/-/raw/master"],
        ["Gitee", "https://gitee.com/vector-wlc/AsmVsZombies/raw/master"],
    ]);
    private extensionRepositoryUrl: Map<string, string> = new Map([
        ["GitHub", "https://github.com/qrmd0/AvZLib/raw/main"],
        ["GitLab", "https://gitlab.com/avzlib/AvZLib/-/raw/main"],
        ["Gitee", "https://gitee.com/qrmd/AvZLib/raw/main"],
    ]);
    private workspaceRoot: readonly vscode.WorkspaceFolder[] | undefined = vscode.workspace.workspaceFolders;
    private runScriptCmd: string = "";
    private fileManager: FileManager = new FileManager;
    private avzDir: string = "";
    private pvzExeName: string = "PlantsVsZombies.exe";
    private extensionName: string = "";
    private extensionVersionName: string = "";
    private avzVersion: string = "";
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
        let oneDirs = fs.readdirSync(avzDir);
        for (let oneDir of oneDirs) {
            if (oneDir.search("AsmVsZombies") !== -1) { // 找到 AsmVsZombies 文件夹
                let twoDirs = fs.readdirSync(avzDir + "/" + oneDir);
                for (let twoDir of twoDirs) {
                    if (twoDir.search("MinGW") !== -1 || twoDir.search("inc") !== -1) { // 确定 AsmVsZombies 子目录
                        this.avzDir = avzDir + "/" + oneDir;
                        vscode.window.showInformationMessage("已找到 AvZ 安装目录 : " + this.avzDir);
                        vscode.workspace.getConfiguration().update('avzConfigure.avzDir', this.avzDir, true);
                        this.createAvzFiles();
                        return;
                    }
                }
            }

            if (oneDir.search("MinGW") !== -1 || oneDir.search("inc") !== -1) { // 确定 AsmVsZombies 子目录
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

    private killGdb() {

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
                this.killGdb();
                this.runCmd(this.runScriptCmd.replace("__FILE_NAME__", fileName));
            }
        }
    }

    public setTerminalClosed() {
        this.avzTerminal = undefined;
    }

    private getAvzEnvVersion(): string {
        let clangPath = this.avzDir + "/MinGW/bin/clang++.exe";
        return fs.existsSync(clangPath) ? "env2" : "env1";
    }

    private getAvzListWithEnv(vList: string[]): string[] {
        let envVersion = this.getAvzEnvVersion();
        let ret: string[] = [];
        for (let index = 0; index < vList.length; index++) {
            if (vList[index].indexOf(envVersion) >= 0) {
                ret.push(vList[index]);
            }
        }
        return ret;
    }

    public getAvzVersionList(): void {
        if (!this.isCanRun()) {
            return;
        }

        if (this.avzDir === "") {
            this.setAvzDir();
        }

        if (this.avzDir !== "") {
            const downloadSource: string = vscode.workspace.getConfiguration().get('avzConfigure.downloadSource')!;
            let avzVersionTxtUrl = `${this.avzRepositoryUrl.get(downloadSource)}/release/version.txt`;
            let avzVersionTxtPath = this.avzDir + "/version.txt";
            this.fileManager.downloadFile(avzVersionTxtUrl, avzVersionTxtPath).then(avzVersionTxtPath => { // 得到版本列表
                let avzVersionList = this.fileManager.readFile(avzVersionTxtPath);
                if (avzVersionList.length === 0) {
                    return;
                }
                avzVersionList = this.getAvzListWithEnv(avzVersionList);
                const options: vscode.QuickPickOptions = {
                    title: "请选择 AvZ 版本"
                };
                vscode.window.showQuickPick(avzVersionList, options).then(avzVersion => { // 得到版本文件
                    if (avzVersion && avzVersion.length !== 0) {
                        let avzVersionUrl = `${this.avzRepositoryUrl.get(downloadSource)}/release/${avzVersion}`;
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

    private getAvzVersion(_this: Avz): void {
        if (this.avzVersion !== "") {
            return;
        }
        const strList = _this.fileManager.readFile(_this.avzDir + "/inc/libavz.h");
        for (let index = 0; index < strList.length; index++) {
            const element = strList[index];
            if (element.indexOf("__AVZ_VERSION__") !== -1) {
                _this.avzVersion = element.split(" ")[2];
                _this.avzVersion = "20" + _this.avzVersion.substring(0, 2) + "_" + _this.avzVersion.substring(2, 4) + "_" + _this.avzVersion.substring(4, 6);
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

        this.extensionDownloadList = [];

        let incDir = fs.readdirSync(this.avzDir + "/inc", { withFileTypes: true });
        for (const entry of incDir) { // 读取已经安装的插件列表
            if (entry.isDirectory()) {
                this.extensionDownloadList.push(entry.name);
            }
        }

        if (this.avzDir !== "") {
            const downloadSource: string = vscode.workspace.getConfiguration().get('avzConfigure.downloadSource')!;
            let extensionListRemotePath = `${this.extensionRepositoryUrl.get(downloadSource)}/extension_list.txt`;
            let extensionListLocalPath = this.avzDir + "/extension_list.txt";
            this.fileManager.downloadToPick(extensionListRemotePath, extensionListLocalPath, "请选择插件").then(extensionName => {
                this.extensionName = extensionName;
                let versionTxtRemotePath = `${this.extensionRepositoryUrl.get(downloadSource)}/${extensionName}/version.txt`;
                let versionTxtLocalPath = this.avzDir + "/version.txt";
                return this.fileManager.downloadToPick(versionTxtRemotePath, versionTxtLocalPath, "请选择版本");
            }).then(versionName => {
                this.extensionVersionName = versionName;
                this.installExtension(this, true);
            });
        }
    }

    private getExtensionFullName(extensionName: string): string {
        let extensionListLocalPath = this.avzDir + "/extension_list.txt";
        let extensionList = fs.readFileSync(extensionListLocalPath, "utf-8").split("\n").map(x => x.trimEnd());
        for (const extensionFullName of extensionList) {
            if (extensionFullName.endsWith(extensionName)) {
                return extensionFullName;
            }
        }
        return extensionName;
    }

    private async installExtension(_this: Avz, isForceInstall: boolean = false) {
        let isPush = true;
        // 已经下载过的插件不再进行下载
        for (const extension of _this.extensionDownloadList) {
            if (_this.extensionName.endsWith(extension)) {
                if (!isForceInstall) {
                    vscode.window.showWarningMessage("您已安装过插件: " + extension +
                        ", 因此不再进行重复安装, 如果遇到版本兼容性问题, 请手动安装该插件的其他版本, 如果实在解决不了问题, 请联系插件作者.");
                    return;
                } else {
                    isPush = false;
                    break;
                }
            }
        }

        if (isPush) {
            _this.extensionDownloadList.push(_this.extensionName.split("/")[1]);
        }

        const downloadSource: string = vscode.workspace.getConfiguration().get('avzConfigure.downloadSource')!;
        let extensionRemoteFile = `${_this.extensionRepositoryUrl.get(downloadSource)}/${_this.extensionName}/release/${_this.extensionVersionName}.zip`;
        let extensionLocalFile = _this.avzDir + "/inc/extension.zip";
        await _this.fileManager.downloadFile(extensionRemoteFile, extensionLocalFile);
        execSync(_this.avzDir + "/7z/7z.exe x " + _this.avzDir + "/inc/extension.zip -aoa -o" + _this.avzDir + "/inc");
        // 读取插件的依赖列表
        let extensionName = _this.extensionName.split("/")[1];
        const strList = _this.fileManager.readFile(_this.avzDir + "/inc/" + extensionName + "/information.txt");
        for (let idx = 0; idx < strList.length; ++idx) {
            if (strList[idx] === "") {
                continue;
            }
            if (idx === 1) { // AvZ Version
                _this.getAvzVersion(_this);
                let needAvzVersion = strList[idx].split(" ")[1];
                if (needAvzVersion.indexOf(_this.avzVersion) === -1) {
                    vscode.window.showWarningMessage("您下载的插件 " + extensionName + " 依赖的 AvZ 版本为 " + needAvzVersion +
                        ", 但是现在的 AvZ 版本为 " + _this.avzVersion + ", 这可能带来不兼容问题!");
                }
            } else if (idx > 1) {
                let tempList = strList[idx].split(" ");
                _this.extensionName = this.getExtensionFullName(tempList[0]);
                _this.extensionVersionName = tempList[1];
                await _this.installExtension(_this);
            }
        }
        vscode.window.showInformationMessage("插件: " + _this.extensionName.split("/")[1] + " 安装结束");
    }
}