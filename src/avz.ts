// Copyright (C) 2021-2025 AsmVsZombies Team
//
// This file is part of AvZ VSCode Extension.
//
// AvZ VSCode Extension is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by the
// Free Software Foundation, either version 3 of the License, or (at your
// option) any later version.
//
// AvZ VSCode Extension is distributed in the hope that it will be useful, but
// WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY
// or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for
// more details.
//
// You should have received a copy of the GNU General Public License along with
// AvZ VSCode Extension. If not, see <https://www.gnu.org/licenses/>.

import { exec, execSync, ExecException } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as vscode from 'vscode';
import * as fileUtils from './file_utils';
import * as templateStrs from './template_strs';

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
    private avzDir = "";
    private avzTerminal: vscode.Terminal | undefined = vscode.window.terminals.find(terminal => terminal.name === "AvZ");
    private avzVersion = "";
    private envType = 0;
    private extensionDownloadList: string[] = [];


    constructor() {
        fileUtils.mkDir(this.tmpDir);
    }


    private static execute(cmd: string): Promise<[error: ExecException | null, stdout: string]> {
        return new Promise(callback => {
            exec(cmd, (error, stdout) => { callback([error, stdout]); });
        });
    }


    private static killGdb(): void {
        try {
            execSync("taskkill /f /im gdb32.exe");
        } catch { }
    }


    private static hasOpenFolder(): boolean {
        if (vscode.workspace.workspaceFolders !== undefined) {
            return true;
        }
        vscode.window.showErrorMessage(vscode.l10n.t("You must have the folder open to execute the AvZ command!"));
        return false;
    }


    private createAvzFiles(): void {
        const projectDir = vscode.workspace.workspaceFolders![0].uri.fsPath;
        fileUtils.mkDir(projectDir + "/bin");
        fileUtils.mkDir(projectDir + "/.vscode");
        fileUtils.writeFile(projectDir + "/.vscode/c_cpp_properties.json", templateStrs.generateCCppJson(this.avzDir, this.envType), false);
        fileUtils.writeFile(projectDir + "/.vscode/settings.json", templateStrs.generateSettingsJson(this.avzDir, this.envType), false);
        fileUtils.writeFile(projectDir + "/.vscode/tasks.json", templateStrs.generateTasksJson(this.avzDir, this.envType), false);
        fileUtils.writeFile(projectDir + "/.vscode/launch.json", templateStrs.generateLaunchJson(this.avzDir, this.envType), false);
        if (vscode.extensions.getExtension(Avz.clangdId) !== undefined) {
            fileUtils.writeFile(projectDir + "/.clang-format", templateStrs.generateClangFormat(this.avzDir, this.envType), false);
        }
        fileUtils.writeFile(this.avzDir + "/metadata.json", templateStrs.generateMetadataJson(this.avzDir, this.envType), false);
    }


    /**
     * @retval true: 成功设置 AvZ 目录
     * @retval false: 失败
     */
    public setAvzDir(avzDir: string = ""): boolean {
        if (!Avz.hasOpenFolder()) {
            return false;
        }
        if (avzDir === "") {
            if ((avzDir = vscode.workspace.getConfiguration().get("avzConfigure.avzDir")!) === "") {
                avzDir = vscode.workspace.workspaceFolders![0].uri.fsPath;
            }
        }

        avzDir = avzDir.replaceAll("\\", "/");
        if (avzDir.endsWith("/")) {
            avzDir = avzDir.slice(0, -1);
        }

        const subdirs = fs.readdirSync(avzDir).map(subdir => avzDir + "/" + subdir);
        const dirs = [avzDir].concat(subdirs);
        for (const dir of dirs) {
            if (fs.existsSync(dir + "/MinGW")) { // 确定 AsmVsZombies 子目录
                this.avzDir = dir;
                this.envType = fs.existsSync(this.avzDir + "/MinGW/bin/libLLVM-15.dll") ? 2 : 1;
                this.createAvzFiles();
                vscode.workspace.getConfiguration().update("avzConfigure.avzDir", this.avzDir, false);
                vscode.window.showInformationMessage(vscode.l10n.t("AvZ {envType} installation directory has been found: {dir}", { envType: this.envType, dir: this.avzDir }));
                return true;
            }
        }
        vscode.window.showErrorMessage(vscode.l10n.t("The valid AvZ installation directory was not found, try re-running the command \"AvZ: Set AvZ Dir\"."));
        return false;
    }


    public runCmd(cmd: string): void {
        this.avzTerminal ??= vscode.window.createTerminal("AvZ", "cmd");
        this.avzTerminal.sendText(cmd);
        this.avzTerminal.show();
    }


    private runScripImp(isMaskCmd: boolean): void {
        if (!Avz.hasOpenFolder()) {
            return;
        }
        if ((this.avzDir === "") && !this.setAvzDir()) {
            return;
        }
        if (vscode.window.activeTextEditor === undefined) {
            vscode.window.showErrorMessage(vscode.l10n.t("Please open the script file that needs to be run"));
            return;
        }

        const metadata = JSON.parse(fs.readFileSync(this.avzDir + "/metadata.json", "utf8")) as { compileOptions: string };
        const customOptions = vscode.workspace.getConfiguration().get<string[]>("avzConfigure.compileOptions")!;
        const compileOptions = metadata.compileOptions.replaceAll("__CUSTOM_ARGS__", customOptions.join(" "));
        const command = vscode.workspace.getConfiguration().get<string>("avzConfigure.avzRunScriptCmd")!
            .replaceAll("__COMPILER_CMD__", compileOptions)
            .replaceAll("__AVZ_DIR__", this.avzDir)
            .replaceAll("__FILE_NAME__", vscode.window.activeTextEditor.document.fileName);

        vscode.window.activeTextEditor.document.save();
        Avz.killGdb();

        if (!isMaskCmd) {
            this.runCmd(command);
            return;
        }
        try {
            execSync(command);
        } catch (err) {
            vscode.window.showErrorMessage(vscode.l10n.t("Failed to run script. ({error})", { error: (err as Error).message }));
        }
    }


    public runScriptInTerminal(): void {
        this.runScripImp(false);
    }


    public runScriptMaskCmd(): void {
        this.runScripImp(true);
    }


    public closeTerminal(): void {
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


    public updateAvz(): void {
        if (!Avz.hasOpenFolder()) {
            return;
        }
        if ((this.avzDir === "") && !this.setAvzDir()) {
            return;
        }

        const downloadSource = vscode.workspace.getConfiguration().get<string>("avzConfigure.downloadSource")!;
        const avzVersionTxtUrl = `${Avz.avzRepositoryUrl.get(downloadSource)}/release/version.txt`;
        const avzVersionTxtPath = this.tmpDir + "/version.txt";
        fileUtils.downloadFile(avzVersionTxtUrl, avzVersionTxtPath).then(async () => { // 下载版本列表
            const avzVersionList = fileUtils.readFile(avzVersionTxtPath).filter(ver => ver.startsWith(`env${this.envType}`));
            if (avzVersionList.length === 0) {
                return;
            }
            const avzVersion = await vscode.window.showQuickPick(avzVersionList, { title: vscode.l10n.t("Select AvZ Version") });
            if (avzVersion === undefined || avzVersion === "") {
                return;
            }
            const avzVersionUrl = `${Avz.avzRepositoryUrl.get(downloadSource)}/release/${avzVersion}`;
            const avzFilePath = this.tmpDir + "/avz.zip";
            await fileUtils.downloadFile(avzVersionUrl, avzFilePath); // 下载 AvZ 压缩包
            execSync(`"${this.avzDir}/7z/7z.exe" x "${avzFilePath}" -aoa -o"${this.avzDir}"`);
            vscode.window.showInformationMessage(vscode.l10n.t("AvZ updated successfully."));
            this.recommendClangd();
        });
    }


    public getPvzExePath(): string {
        const pvzExeName = vscode.workspace.getConfiguration().get<string>("avzConfigure.pvzExeName")!;
        const output = execSync(`wmic process where name="${pvzExeName}" get ExecutablePath`).toString();
        const exePath = output.split("\n")[1].trim();
        if (exePath === "") {
            vscode.window.showErrorMessage(vscode.l10n.t("PvZ is not activated!"));
        } else {
            vscode.window.showInformationMessage(vscode.l10n.t("Executable path of PvZ has been found: ") + exePath);
        }
        return exePath;
    }


    public getPvzProcessId(): string {
        const pvzExeName = vscode.workspace.getConfiguration().get<string>("avzConfigure.pvzExeName")!;
        const output = execSync(`wmic process where name="${pvzExeName}" get ProcessId`).toString();
        const pid = output.split("\n")[1].trim();
        if (pid === "") {
            vscode.window.showErrorMessage(vscode.l10n.t("PvZ is not activated!"));
        } else {
            vscode.window.showInformationMessage(vscode.l10n.t("Process ID of PvZ has been found: ") + pid);
        }
        return pid;
    }


    public buildAvz(): void {
        if (!Avz.hasOpenFolder()) {
            return;
        }
        if ((this.avzDir === "") && !this.setAvzDir()) {
            return;
        }

        type Progress = vscode.Progress<{
            message?: string;
            increment?: number;
        }>;
        const progressBuild = async (progress: Progress) => {
            const srcFiles = fs.readdirSync(this.avzDir + "/src").filter(fileName => fileName.endsWith(".cpp"));
            const srcFileCnt = srcFiles.length;
            const customOptions = vscode.workspace.getConfiguration().get<string[]>("avzConfigure.compileOptions")!;
            const compileCmd = templateStrs.generateCompileCmd(this.avzDir, this.envType).replaceAll("__CUSTOM_ARGS__", customOptions.join(" "));
            const [error, stdout] = await Avz.execute("echo %NUMBER_OF_PROCESSORS%");
            if (error !== null) {
                throw error;
            }
            const cpuCnt = Number(stdout);
            let lastPercentage = 0;
            let finishCnt = 0;

            // 多进程加速编译
            const worker = async (taskList: number[]) => {
                for (const idx of taskList) {
                    const srcFile = srcFiles[idx];
                    const cmd = compileCmd.replaceAll("__FILE_NAME__", `${this.avzDir}/src/${srcFile}`);
                    const [err] = await Avz.execute(cmd);
                    if (err !== null) { // 继续编译
                        vscode.window.showErrorMessage(vscode.l10n.t("Failed to compile file \"{file}\". ({error})", { file: srcFile, error: err.message }));
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
            let taskTable: number[][] = Array.from<unknown, number[]>({ length: cpuCnt }, () => []);
            for (let idx = 0; idx < srcFileCnt; ++idx) {
                taskTable[idx % cpuCnt].push(idx);
            }

            // 执行任务, 并等待任务完成
            await Promise.all(taskTable.map(worker));

            const libavzPath = this.avzDir + "/bin/libavz.a";
            if (fs.existsSync(libavzPath)) {
                fs.unlinkSync(libavzPath);
            }

            execSync(templateStrs.generatePackCmd(this.avzDir)); // may throw

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
        vscode.window.withProgress(progressOptions, progressBuild).then(
            () => { vscode.window.showInformationMessage(vscode.l10n.t("AvZ built successfully.")); },
            (reason: Error) => { vscode.window.showErrorMessage(vscode.l10n.t("Failed to build AvZ. ({error})", { error: reason.message })); }
        );
    }


    public getAvzExtension(): void {
        if (!Avz.hasOpenFolder()) {
            return;
        }
        if ((this.avzDir === "") && !this.setAvzDir()) {
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
        fileUtils.downloadToPick(extensionListRemotePath, extensionListLocalPath, vscode.l10n.t("Select Extension")).then(extensionFullName => {
            const versionTxtRemotePath = `${Avz.extensionRepositoryUrl.get(downloadSource)}/${extensionFullName}/version.txt`;
            const versionTxtLocalPath = this.tmpDir + "/version.txt";
            fileUtils.downloadToPick(versionTxtRemotePath, versionTxtLocalPath, vscode.l10n.t("Select Version")).then(extensionVersion => {
                this.installExtension(extensionFullName, extensionVersion, true);
            });
        });
    }


    private getAvzVersion(): void {
        if (this.avzVersion !== "") {
            return;
        }
        const lines = fileUtils.readFile(this.avzDir + "/inc/libavz.h");
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
        const extensionList = fileUtils.readFile(extensionListLocalPath).map(line => line.trimEnd());
        return extensionList.find(extensionFullName => extensionFullName.endsWith("/" + extensionName)) ?? extensionName;
    }


    private async installExtension(extensionFullName: string, extensionVersion: string, isForceInstall: boolean = false): Promise<void> {
        const extensionName = extensionFullName.split("/")[1];

        const hasInstalled = this.extensionDownloadList.includes(extensionName);
        if (!hasInstalled) {
            this.extensionDownloadList.push(extensionName);
        } else if (!isForceInstall) {
            vscode.window.showWarningMessage(vscode.l10n.t("You have already installed the extension \"{0}\", so it will not be installed again. If you encounter version compatibility issues, please manually install another version of the extension; if you can't solve the problem, please contact the author of the extension.", extensionName));
            return;
        }

        const downloadSource = vscode.workspace.getConfiguration().get<string>("avzConfigure.downloadSource")!;
        const extensionRemoteFile = `${Avz.extensionRepositoryUrl.get(downloadSource)}/${extensionFullName}/release/${extensionVersion}.zip`;
        const extensionLocalFile = this.tmpDir + "/extension.zip";
        await fileUtils.downloadFile(extensionRemoteFile, extensionLocalFile);
        execSync(`"${this.avzDir}/7z/7z.exe" x "${extensionLocalFile}" -aoa -o"${this.avzDir}/inc"`);
        vscode.window.showInformationMessage(vscode.l10n.t("Extension \"{0}\" installed successfully.", extensionName));
        // 读取插件的依赖列表
        const lines = fileUtils.readFile(`${this.avzDir}/inc/${extensionName}/information.txt`).map(line => line.trimEnd()).filter(line => line !== "");
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
