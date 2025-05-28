/*
 * @Coding: utf-8
 * @Author: vector-wlc
 * @Date: 2021-08-18 13:59:24
 * @Description:
 */

import { exec, execSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as vscode from 'vscode';
import * as file_utils from './file_utils';
import * as template_strs from './template_strs';

export class Avz {
    private static readonly avzRepositoryUrl: ReadonlyMap<string, string> = new Map([
        ["GitHub", "https://github.com/vector-wlc/AsmVsZombies/raw/master"],
        ["GitLab", "https://gitlab.com/vector-wlc/AsmVsZombies/-/raw/master"],
        ["Gitee", "https://gitee.com/vector-wlc/AsmVsZombies/raw/master"],
    ]);
    private static readonly extensionRepositoryUrl: ReadonlyMap<string, string> = new Map([
        ["GitHub", "https://github.com/qrmd0/AvZLib/raw/main"],
        ["GitLab", "https://gitlab.com/avzlib/AvZLib/-/raw/main"],
        ["Gitee", "https://gitee.com/qrmd/AvZLib/raw/main"],
    ]);
    private static readonly clangdId = "llvm-vs-code-extensions.vscode-clangd";

    private readonly tmpDir: string = os.tmpdir() + "/AsmVsZombies";
    private avzDir: string = "";
    private avzTerminal: vscode.Terminal | undefined = vscode.window.terminals.find(terminal => terminal.name === "AvZ");
    private avzVersion: string = "";
    private envType: number = 0;
    private extensionDownloadList: string[] = [];


    constructor() {
        file_utils.mkDir(this.tmpDir);
    }


    // 函数正常运行时, 元组中第一个元素为空字符串, 第二个元素为运行结果
    // 运行失败时, 第一个元素为失败原因
    private static execute(cmd: string): Promise<[err: string, out: string]> {
        return new Promise<[string, string]>(callback => {
            exec(cmd, (error, stdout) => { callback([error?.message ?? "", stdout]); });
        });
    }


    private static killGdb(): void {
        try {
            execSync("taskkill /F /IM gdb32.exe");
        } catch { }
    }


    private isRunnable(): boolean {
        if (vscode.workspace.workspaceFolders !== undefined) {
            return true;
        }
        vscode.window.showErrorMessage(vscode.l10n.t("You must have the folder open to execute the AvZ command!"));
        return false;
    }


    private createAvzFiles(): void {
        const projectDir = vscode.workspace.workspaceFolders![0].uri.fsPath;
        file_utils.mkDir(projectDir + "/bin");
        file_utils.mkDir(projectDir + "/.vscode");
        file_utils.writeFile(projectDir + "/.vscode/c_cpp_properties.json", template_strs.generateCCppJson(this.avzDir, this.envType), false);
        file_utils.writeFile(projectDir + "/.vscode/settings.json", template_strs.generateSettingsJson(this.avzDir, this.envType), false);
        file_utils.writeFile(projectDir + "/.vscode/tasks.json", template_strs.generateTasksJson(this.avzDir, this.envType), false);
        file_utils.writeFile(projectDir + "/.vscode/launch.json", template_strs.generateLaunchJson(this.avzDir, this.envType), false);
        if (vscode.extensions.getExtension(Avz.clangdId) !== undefined) {
            file_utils.writeFile(projectDir + "/.clang-format", template_strs.generateClangFormat(this.avzDir, this.envType), false);
        }
        file_utils.writeFile(this.avzDir + "/metadata.json", template_strs.generateMetadataJson(this.avzDir, this.envType), false);
    }


    public setAvzDir(avzDir: string = ""): void {
        if (!this.isRunnable()) {
            return;
        }
        if (avzDir === "") {
            avzDir = vscode.workspace.getConfiguration().get<string>("avzConfigure.avzDir")!;
        }
        if (avzDir === "") {
            avzDir = vscode.workspace.workspaceFolders![0].uri.fsPath;
        }

        avzDir = avzDir.replaceAll("\\", "/");
        if (avzDir.endsWith("/")) {
            avzDir = avzDir.substring(0, avzDir.length - 1);
        }

        const subdirs = fs.readdirSync(avzDir).map(subdir => avzDir + "/" + subdir);
        const dirs = [avzDir].concat(subdirs);
        for (const dir of dirs) {
            if (fs.existsSync(dir + "/MinGW")) { // 确定 AsmVsZombies 子目录
                this.avzDir = dir;
                this.envType = fs.existsSync(this.avzDir + "/MinGW/bin/libLLVM-15.dll") ? 2 : 1;
                this.createAvzFiles();
                vscode.workspace.getConfiguration().update("avzConfigure.avzDir", this.avzDir, false);
                vscode.window.showInformationMessage(vscode.l10n.t("AvZ installation directory has been found: ") + this.avzDir);
                return;
            }
        }
        vscode.window.showErrorMessage(vscode.l10n.t("The valid AvZ installation directory was not found, try re-running the command \"AvZ: Set AvZ Dir\"."));
    }


    public runCmd(cmd: string): void {
        this.avzTerminal ??= vscode.window.createTerminal("AvZ", "cmd");
        this.avzTerminal.sendText(cmd);
        this.avzTerminal.show();
    }


    private runScripImp(isMaskCmd: boolean): void {
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
            vscode.window.showErrorMessage(vscode.l10n.t("Please open the script file that needs to be run"));
            return;
        }

        const metadata = JSON.parse(fs.readFileSync(this.avzDir + "/metadata.json", "utf8"));
        const customOptions = vscode.workspace.getConfiguration().get<string[]>("avzConfigure.compileOptions")!;
        const compileOptions = (metadata.compileOptions as string).replaceAll("__CUSTOM_ARGS__", customOptions.join(" "));
        let command = vscode.workspace.getConfiguration().get<string>("avzConfigure.avzRunScriptCmd")!;
        command = command.replaceAll("__COMPILER_CMD__", compileOptions)
            .replaceAll("__AVZ_DIR__", this.avzDir)
            .replaceAll("__FILE_NAME__", vscode.window.activeTextEditor.document.fileName);

        vscode.window.activeTextEditor.document.save();
        Avz.killGdb();
        if (isMaskCmd) {
            execSync(command);
        } else {
            this.runCmd(command);
        }
    }


    public runScriptInTerminal(): void {
        this.runScripImp(false);
    }


    public runScriptMaskCmd(): void {
        this.runScripImp(true);
    }


    public setTerminalClosed(): void {
        this.avzTerminal = undefined;
    }


    private recommendClangd(): void {
        if (this.envType === 1 // AvZ 1 环境包中不包含 clangd
            || vscode.extensions.getExtension(Avz.clangdId) !== undefined) {
            return;
        }
        const message = vscode.l10n.t("It is recommended to install the clangd extension for a better code hinting and formatting experience.");
        const install = vscode.l10n.t("Install");
        vscode.window.showInformationMessage(message, install).then(selection => {
            if (selection === install) {
                vscode.commands.executeCommand("extension.open", Avz.clangdId);
            }
        });
    }


    public getAvzVersionList(): void {
        if (!this.isRunnable()) {
            return;
        }
        if (this.avzDir === "") {
            this.setAvzDir();
        }
        if (this.avzDir === "") {
            return;
        }

        const downloadSource = vscode.workspace.getConfiguration().get<string>("avzConfigure.downloadSource")!;
        const avzVersionTxtUrl = `${Avz.avzRepositoryUrl.get(downloadSource)}/release/version.txt`;
        const avzVersionTxtPath = this.tmpDir + "/version.txt";
        file_utils.downloadFile(avzVersionTxtUrl, avzVersionTxtPath).then(avzVersionTxtPath => { // 得到版本列表
            const avzVersionList = file_utils.readFile(avzVersionTxtPath).filter(ver => ver.startsWith("env" + this.envType));
            if (avzVersionList.length === 0) {
                return;
            }
            const options: vscode.QuickPickOptions = {
                title: vscode.l10n.t("Select AvZ version")
            };
            vscode.window.showQuickPick(avzVersionList, options).then(avzVersion => { // 得到版本文件
                if (avzVersion === undefined || avzVersion === "") {
                    return;
                }
                const avzVersionUrl = `${Avz.avzRepositoryUrl.get(downloadSource)}/release/${avzVersion}`;
                const avzFilePath = this.tmpDir + "/avz.zip";
                file_utils.downloadFile(avzVersionUrl, avzFilePath).then(() => {
                    execSync(`"${this.avzDir}/7z/7z.exe" x "${avzFilePath}" -aoa -o"${this.avzDir}"`);
                    vscode.window.showInformationMessage(vscode.l10n.t("AvZ updated successfully."));
                    this.recommendClangd();
                });
            });
        });
    }


    public getPvzExePath(): string {
        // 得到 pvzExeName
        const pvzExeName = vscode.workspace.getConfiguration().get<string>("avzConfigure.pvzExeName")!;

        // 寻找 Path
        const output = execSync(`wmic process where name="${pvzExeName}" get ExecutablePath`).toString();
        const pvzExePath = output.split("\n")[1].trim();
        if (pvzExePath.includes(pvzExeName)) {
            vscode.window.showInformationMessage(vscode.l10n.t("Executable path of PvZ has been found: ") + pvzExePath);
            return pvzExePath;
        }
        vscode.window.showErrorMessage(vscode.l10n.t("PvZ is not activated!"));
        return "";
    }


    public getPvzProcessId(): string {
        // 得到 pvzExeName
        const pvzExeName = vscode.workspace.getConfiguration().get<string>("avzConfigure.pvzExeName")!;

        // 寻找 PID
        let output = "";
        try {
            output = execSync(`tasklist |find /i "${pvzExeName}"`).toString();
        } catch {
            vscode.window.showErrorMessage(vscode.l10n.t("PvZ is not activated!"));
            return "";
        }

        const [pname, pid] = output.trim().split(/\s+/);
        if (pname.includes("PlantsVsZombies.exe") && Number(pid)) {
            vscode.window.showInformationMessage(vscode.l10n.t("PID of PvZ has been found: ") + pid);
            return pid;
        }
        vscode.window.showErrorMessage(vscode.l10n.t("PID of PvZ not found!"));
        return "";
    }


    // 编译 avz 库
    public build(): void {
        if (!this.isRunnable()) {
            return;
        }
        if (this.avzDir === "") {
            this.setAvzDir();
        }
        if (this.avzDir === "") {
            return;
        }

        type Progress = vscode.Progress<{
            message?: string;
            increment?: number;
        }>;
        const progressBuild = async (progress: Progress) => {
            const srcFiles = fs.readdirSync(this.avzDir + "/src").filter(file => file.endsWith(".cpp"));
            const srcFileCnt = srcFiles.length;
            const customOptions = vscode.workspace.getConfiguration().get<string[]>("avzConfigure.compileOptions")!;
            const compileCmd = template_strs.generateCompileCmd(this.avzDir, this.envType).replaceAll("__CUSTOM_ARGS__", customOptions.join(" "));
            const [error, stdout] = await Avz.execute("echo %number_of_processors%");
            if (error !== "") {
                vscode.window.showErrorMessage(vscode.l10n.t("Failed to get number of processors. ({error})", { error: error }));
                return;
            }
            const cpuCnt = Number(stdout);
            let lastPercentage = 0;
            let finishCnt = 0;

            // 多进程加速编译
            const worker = async (idxs: number[]) => {
                for (const idx of idxs) {
                    const srcFile = srcFiles[idx];
                    const cmd = compileCmd.replaceAll("__FILE_NAME__", `${this.avzDir}/src/${srcFile}`);
                    const [err] = await Avz.execute(cmd);
                    if (err !== "") { // 还不能 return, 否则进度条会卡住
                        vscode.window.showErrorMessage(vscode.l10n.t("Failed to compile file \"{file}\". ({error})", { file: srcFile, error: err }));
                    }
                    const percentage = Math.round(++finishCnt / srcFileCnt * 100);
                    progress.report({
                        message: `${percentage}%`,
                        increment: percentage - lastPercentage
                    });
                    lastPercentage = percentage;
                }
            };

            // 分配任务
            let totalIdxs: number[][] = Array.from<unknown, number[]>({ length: cpuCnt }, () => []);
            for (let i = 0; i < srcFileCnt; ++i) {
                totalIdxs[i % totalIdxs.length].push(i);
            }

            // 执行任务
            for (const idxs of totalIdxs) {
                worker(idxs);
            }

            // 忙等待上述任务完成
            const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
            while (finishCnt < srcFileCnt) {
                await sleep(500);
            }

            const libavzPath = this.avzDir + "/bin/libavz.a";
            if (fs.existsSync(libavzPath)) {
                fs.unlinkSync(libavzPath);
            }

            try {
                execSync(template_strs.generatePackCmd(this.avzDir));
            } catch (err) {
                vscode.window.showErrorMessage(vscode.l10n.t("Failed to package AvZ. ({error})", { error: err }));
                return;
            }

            for (const srcFile of srcFiles) {
                const path = `${this.avzDir}/src/${srcFile}.o`;
                if (fs.existsSync(path)) {
                    fs.unlinkSync(path);
                }
            }
        };

        const progressOptions: vscode.ProgressOptions = {
            location: vscode.ProgressLocation.Notification,
            cancellable: false,
            title: vscode.l10n.t("AvZ library being compiled")
        };
        vscode.window.withProgress(progressOptions, progressBuild);
    }


    public getExtensionList(): void {
        if (!this.isRunnable()) {
            return;
        }
        if (this.avzDir === "") {
            this.setAvzDir();
        }
        if (this.avzDir === "") {
            return;
        }

        this.extensionDownloadList = [];

        const incDir = fs.readdirSync(this.avzDir + "/inc", { withFileTypes: true });
        for (const entry of incDir) { // 读取已经安装的插件列表
            if (entry.isDirectory()) {
                this.extensionDownloadList.push(entry.name);
            }
        }

        const downloadSource = vscode.workspace.getConfiguration().get<string>("avzConfigure.downloadSource")!;
        const extensionListRemotePath = `${Avz.extensionRepositoryUrl.get(downloadSource)}/extension_list.txt`;
        const extensionListLocalPath = this.tmpDir + "/extension_list.txt";
        let extensionFullName = "";
        file_utils.downloadToPick(extensionListRemotePath, extensionListLocalPath, vscode.l10n.t("Select extension")).then(extension => {
            extensionFullName = extension;
            const versionTxtRemotePath = `${Avz.extensionRepositoryUrl.get(downloadSource)}/${extension}/version.txt`;
            const versionTxtLocalPath = this.tmpDir + "/version.txt";
            return file_utils.downloadToPick(versionTxtRemotePath, versionTxtLocalPath, vscode.l10n.t("Select version"));
        }).then(version => {
            this.installExtension(extensionFullName, version, true);
        });
    }


    private getAvzVersion(): void {
        if (this.avzVersion !== "") {
            return;
        }
        const lines = file_utils.readFile(this.avzDir + "/inc/libavz.h");
        for (const line of lines) {
            if (line.includes("__AVZ_VERSION__")) {
                this.avzVersion = line.split(" ")[2];
                this.avzVersion = "20" + this.avzVersion.substring(0, 2) + "_" + this.avzVersion.substring(2, 4) + "_" + this.avzVersion.substring(4, 6);
                return;
            }
        }
    }


    private getExtensionFullName(extensionName: string): string {
        const extensionListLocalPath = this.tmpDir + "/extension_list.txt";
        const extensionList = file_utils.readFile(extensionListLocalPath).map(line => line.trimEnd());
        return extensionList.find(extensionFullName => extensionFullName.endsWith("/" + extensionName)) ?? extensionName;
    }


    private async installExtension(extensionFullName: string, extensionVersion: string, isForceInstall: boolean = false): Promise<void> {
        const extensionName = extensionFullName.split("/")[1];

        const hasInstalled = this.extensionDownloadList.includes(extensionName);
        if (!hasInstalled) {
            this.extensionDownloadList.push(extensionName);
        } else if (!isForceInstall) { // 已经下载过的插件不再进行下载
            vscode.window.showWarningMessage(vscode.l10n.t("You have already installed the extension \"{0}\", so it will not be installed again. If you encounter version compatibility issues, please manually install another version of the extension; if you can't solve the problem, please contact the author of the extension.", extensionName));
            return;
        }

        const downloadSource = vscode.workspace.getConfiguration().get<string>("avzConfigure.downloadSource")!;
        const extensionRemoteFile = `${Avz.extensionRepositoryUrl.get(downloadSource)}/${extensionFullName}/release/${extensionVersion}.zip`;
        const extensionLocalFile = this.tmpDir + "/extension.zip";
        await file_utils.downloadFile(extensionRemoteFile, extensionLocalFile);
        execSync(`"${this.avzDir}/7z/7z.exe" x "${extensionLocalFile}" -aoa -o"${this.avzDir}/inc"`);
        vscode.window.showInformationMessage(vscode.l10n.t("Extension \"{0}\" installed successfully.", extensionName));
        // 读取插件的依赖列表
        const lines = file_utils.readFile(`${this.avzDir}/inc/${extensionName}/information.txt`).map(line => line.trimEnd()).filter(line => line !== "");
        for (const [lineNum, line] of lines.entries()) {
            if (lineNum === 1) { // AvZ Version
                this.getAvzVersion();
                const needAvzVersion = line.split(" ")[1];
                if (!needAvzVersion.includes(this.avzVersion)) {
                    vscode.window.showWarningMessage(vscode.l10n.t("The extension \"{0}\" you downloaded depends on AvZ version {1}, but the current AvZ version is {2}, which may cause an incompatibility issue!", extensionName, needAvzVersion, this.avzVersion));
                }
            } else if (lineNum > 1) {
                const [name, version] = line.split(" ");
                await this.installExtension(this.getExtensionFullName(name), version);
            }
        }
    }
}
