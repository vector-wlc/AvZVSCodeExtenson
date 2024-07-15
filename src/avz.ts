/*
 * @Coding: utf-8
 * @Author: vector-wlc
 * @Date: 2021-08-18 13:59:24
 * @Description:
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as os from 'os';
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
    private fileManager: FileManager = new FileManager;
    private tmpDir: string;
    private avzDir: string = "";
    private envType: number = 0;
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
        this.tmpDir = os.tmpdir() + "\\AsmVsZombies";
        this.fileManager.mkDir(this.tmpDir);
    }

    private isRunnable(): boolean {
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
        this.fileManager.mkDir(projectDir + "/.vscode");
        this.fileManager.mkDir(projectDir + "/bin");
        this.fileManager.writeFile(projectDir + "/.vscode/c_cpp_properties.json", template_strs.generateCCppJson(this.avzDir, this.envType), false);
        this.fileManager.writeFile(projectDir + "/.vscode/settings.json", template_strs.generateSettingsJson(this.avzDir, this.envType), false);
        this.fileManager.writeFile(projectDir + "/.vscode/tasks.json", template_strs.generateTasksJson(this.avzDir, this.envType), false);
        this.fileManager.writeFile(projectDir + "/.vscode/launch.json", template_strs.generateLaunchJson(this.avzDir, this.envType), false);
        this.fileManager.writeFile(this.avzDir + "/metadata.json", template_strs.generateMetadataJson(this.avzDir, this.envType), false);
    }

    public setAvzDir(avzDir: string = ""): void {
        if (!this.isRunnable()) {
            return;
        }

        if (avzDir === "") {
            avzDir = vscode.workspace.getConfiguration().get("avzConfigure.avzDir") ?? "";
        }
        if (avzDir === "") {
            avzDir = this.workspaceRoot![0].uri.fsPath;
        }

        avzDir = this.fileManager.strReplaceAll(avzDir, "\\", "/");
        if (avzDir[avzDir.length - 1] === "/") {
            avzDir = avzDir.substring(0, avzDir.length - 1);
        }

        let subdirs = fs.readdirSync(avzDir).map(x => avzDir + "/" + x);
        let dirs = [avzDir].concat(subdirs);
        for (let dir of dirs) {
            if (fs.existsSync(dir + "/MinGW")) { // 确定 AsmVsZombies 子目录
                this.avzDir = dir;
                this.envType = fs.existsSync(this.avzDir + "/MinGW/bin/libLLVM-15.dll") ? 2 : 1;
                vscode.window.showInformationMessage("已找到 AvZ 安装目录: " + this.avzDir);
                this.createAvzFiles();
                vscode.workspace.getConfiguration().update("avzConfigure.avzDir", this.avzDir, false);
                return;
            }
        }

        vscode.window.showErrorMessage("未找到有效 AvZ 安装目录，请重新尝试运行命令 AvZ: Set AvZ Dir");
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
        } catch (e) { }
    }

    public runScript() {
        if (!this.isRunnable()) {
            return;
        }

        if (this.avzDir === "") {
            this.setAvzDir();
        }
        if (this.avzDir === "") {
            return;
        }
        if (vscode.window.activeTextEditor === undefined) {
            vscode.window.showErrorMessage("请打开需要运行的脚本文件");
            return;
        }

        let metadata = JSON.parse(fs.readFileSync(this.avzDir + "/metadata.json", "utf8"));
        let compileOptions: string = metadata.compileOptions;
        let customOptions: string[] = vscode.workspace.getConfiguration().get('avzConfigure.compileOptions')!;
        compileOptions = this.fileManager.strReplaceAll(compileOptions, "__CUSTOM_ARGS__", customOptions.join(" "));
        let command: string = vscode.workspace.getConfiguration().get('avzConfigure.avzRunScriptCmd')!;
        command = this.fileManager.strReplaceAll(command, "__COMPILER_CMD__", compileOptions);
        command = this.fileManager.strReplaceAll(command, "__AVZ_DIR__", this.avzDir);
        command = this.fileManager.strReplaceAll(command, "__FILE_NAME__", vscode.window.activeTextEditor.document.fileName);

        vscode.window.activeTextEditor.document.save();
        this.killGdb();
        this.runCmd(command);
    }

    public setTerminalClosed() {
        this.avzTerminal = undefined;
    }

    public getAvzVersionList(): void {
        if (!this.isRunnable()) {
            return;
        }

        if (this.avzDir === "") {
            this.setAvzDir();
        }

        if (this.avzDir !== "") {
            const downloadSource: string = vscode.workspace.getConfiguration().get('avzConfigure.downloadSource')!;
            let avzVersionTxtUrl = `${this.avzRepositoryUrl.get(downloadSource)}/release/version.txt`;
            let avzVersionTxtPath = this.tmpDir + "/version.txt";
            this.fileManager.downloadFile(avzVersionTxtUrl, avzVersionTxtPath).then(avzVersionTxtPath => { // 得到版本列表
                let avzVersionList = this.fileManager.readFile(avzVersionTxtPath);
                if (avzVersionList.length === 0) {
                    return;
                }
                avzVersionList = avzVersionList.filter(x => x.startsWith("env" + this.envType));
                const options: vscode.QuickPickOptions = {
                    title: "请选择 AvZ 版本"
                };
                vscode.window.showQuickPick(avzVersionList, options).then(avzVersion => { // 得到版本文件
                    if (avzVersion && avzVersion.length !== 0) {
                        let avzVersionUrl = `${this.avzRepositoryUrl.get(downloadSource)}/release/${avzVersion}`;
                        let avzFilePath = this.tmpDir + "/avz.zip";
                        this.fileManager.downloadFile(avzVersionUrl, avzFilePath).then(_ => {
                            execSync(`"${this.avzDir}/7z/7z.exe" x "${avzFilePath}" -aoa -o"${this.avzDir}"`);
                            vscode.window.showInformationMessage("AvZ 更新成功");
                        });
                    }
                });
            });
        }
    }

    public getPvzExePath(): string {
        // 得到 pvzExeName
        this.pvzExeName = vscode.workspace.getConfiguration().get('avzConfigure.pvzExeName')!;

        // 寻找 Path
        let output = execSync("wmic process where name=\"" + this.pvzExeName + "\" get ExecutablePath").toString();
        let pvzExePathList = output.split("\n");
        if (pvzExePathList[1].indexOf(this.pvzExeName) >= 0) {
            let pvzExePath = pvzExePathList[1].trim();
            return pvzExePath;
        }

        return "PvZ is not activated!";
    }

    public getPvzProcessId(): string {
        // 得到 pvzExeName
        this.pvzExeName = vscode.workspace.getConfiguration().get('avzConfigure.pvzExeName')!;

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
        for (const element of strList) {
            if (element.indexOf("__AVZ_VERSION__") !== -1) {
                _this.avzVersion = element.split(" ")[2];
                _this.avzVersion = "20" + _this.avzVersion.substring(0, 2) + "_" + _this.avzVersion.substring(2, 4) + "_" + _this.avzVersion.substring(4, 6);
                break;
            }
        }
    }

    public getExtensionList(): void {
        if (!this.isRunnable()) {
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
            let extensionListLocalPath = this.tmpDir + "/extension_list.txt";
            this.fileManager.downloadToPick(extensionListRemotePath, extensionListLocalPath, "请选择插件").then(extensionName => {
                this.extensionName = extensionName;
                let versionTxtRemotePath = `${this.extensionRepositoryUrl.get(downloadSource)}/${extensionName}/version.txt`;
                let versionTxtLocalPath = this.tmpDir + "/version.txt";
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
        let extensionLocalFile = _this.tmpDir + "/extension.zip";
        await _this.fileManager.downloadFile(extensionRemoteFile, extensionLocalFile);
        execSync(`"${_this.avzDir}/7z/7z.exe" x "${extensionLocalFile}" -aoa -o"${_this.avzDir + "/inc"}"`);
        vscode.window.showInformationMessage(`插件 ${_this.extensionName.split("/")[1]} 安装成功`);
        // 读取插件的依赖列表
        let extensionName = _this.extensionName.split("/")[1];
        const strList = _this.fileManager.readFile(_this.avzDir + "/inc/" + extensionName + "/information.txt");
        let lineNumber = 0;
        for (const line in strList) {
            if (line === "") {
                continue;
            }
            if (lineNumber === 1) { // AvZ Version
                _this.getAvzVersion(_this);
                let needAvzVersion = line.split(" ")[1];
                if (needAvzVersion.indexOf(_this.avzVersion) === -1) {
                    vscode.window.showWarningMessage("您下载的插件 " + extensionName + " 依赖的 AvZ 版本为 " + needAvzVersion +
                        ", 但是现在的 AvZ 版本为 " + _this.avzVersion + ", 这可能带来不兼容问题!");
                }
            } else if (lineNumber > 1) {
                let tempList = line.split(" ");
                _this.extensionName = this.getExtensionFullName(tempList[0]);
                _this.extensionVersionName = tempList[1];
                await _this.installExtension(_this);
            }
            lineNumber++;
        }
    }
}
