/*
 * Copyright (C) 2021-2025 AsmVsZombies Team
 *
 * This file is part of AvZ VSCode Extension.
 *
 * AvZ VSCode Extension is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by the
 * Free Software Foundation, either version 3 of the License, or (at your
 * option) any later version.
 *
 * AvZ VSCode Extension is distributed in the hope that it will be useful, but
 * WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY
 * or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for
 * more details.
 *
 * You should have received a copy of the GNU General Public License along with
 * AvZ VSCode Extension. If not, see <https://www.gnu.org/licenses/>.
 */

import { exec, execSync, ExecException } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as vscode from 'vscode';
import * as fileUtils from './file_utils';
import * as templateStrs from './template_strs';

const enum RepoType {
    GITHUB = "GitHub",
    GITLAB = "GitLab",
    GITEE = "Gitee"
}

export class Avz {
    private static readonly avzRepoUrl: ReadonlyMap<string, string> = new Map([
        [RepoType.GITHUB, "https://github.com/vector-wlc/AsmVsZombies/raw/master"],
        [RepoType.GITLAB, "https://gitlab.com/vector-wlc/AsmVsZombies/-/raw/master"],
        [RepoType.GITEE, "https://gitee.com/vector-wlc/AsmVsZombies/raw/master"],
    ]);
    private static readonly extensionRepoUrl: ReadonlyMap<string, string> = new Map([
        [RepoType.GITHUB, "https://github.com/qrmd0/AvZLib/raw/main"],
        [RepoType.GITLAB, "https://gitlab.com/avzlib/AvZLib/-/raw/main"],
        [RepoType.GITEE, "https://gitee.com/qrmd/AvZLib/raw/main"],
    ]);
    private static readonly clangdId = "llvm-vs-code-extensions.vscode-clangd";

    private readonly tmpDir: string = os.tmpdir() + "/AsmVsZombies";
    private avzDir = "";
    private avzTerminal: vscode.Terminal | undefined = vscode.window.terminals.find(terminal => terminal.name === "AvZ");
    private avzVersion = "";
    private envType = 0;
    private extensionInstalledList = new Set<string>();


    constructor() {
        fileUtils.mkDir(this.tmpDir);
    }


    private static execute(command: string): Promise<[error: ExecException | null, stdout: string]> {
        return new Promise(callback => {
            exec(command, (error, stdout) => { callback([error, stdout]); });
        });
    }


    private static hasOpenFolder(): boolean {
        if (vscode.workspace.workspaceFolders !== undefined) {
            return true;
        }
        vscode.window.showErrorMessage(vscode.l10n.t("You must have the folder open to execute the AvZ command!"));
        return false;
    }


    private createConfigFiles(): void {
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
    public setAvzDir(dirPath: string = ""): boolean {
        if (!Avz.hasOpenFolder()) {
            return false;
        }
        if (dirPath === "") {
            dirPath = vscode.workspace.getConfiguration().get("avzConfigure.avzDir")!;
            if (dirPath === "") {
                dirPath = vscode.workspace.workspaceFolders![0].uri.fsPath;
            }
        }

        dirPath = dirPath.replaceAll("\\", "/");
        if (dirPath.endsWith("/")) {
            dirPath = dirPath.slice(0, -1);
        }

        const paths = [dirPath, ...fs.readdirSync(dirPath).map(entryName => dirPath + "/" + entryName)];
        for (const path of paths) {
            if (fs.existsSync(path + "/MinGW")) { // 确定 AsmVsZombies 子目录
                this.avzDir = path;
                this.envType = fs.existsSync(this.avzDir + "/MinGW/bin/libLLVM-15.dll") ? 2 : 1;
                this.createConfigFiles();
                vscode.workspace.getConfiguration().update("avzConfigure.avzDir", this.avzDir, false);
                vscode.window.showInformationMessage(vscode.l10n.t("AvZ installation directory has been found: ") + this.avzDir);
                return true;
            }
        }
        vscode.window.showErrorMessage(vscode.l10n.t("The valid AvZ installation directory was not found, try re-running the command \"AvZ: Set AvZ Dir\"."));
        return false;
    }


    public closeTerminal(): void {
        this.avzTerminal = undefined;
    }


    public runCmd(command: string): void {
        this.avzTerminal ??= vscode.window.createTerminal("AvZ", "cmd");
        this.avzTerminal.sendText(command);
        this.avzTerminal.show();
    }


    private async runScripImp(isMaskCmd: boolean): Promise<void> {
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
        if (!await vscode.window.activeTextEditor.document.save()) {
            vscode.window.showErrorMessage(vscode.l10n.t("Failed to save the script file."));
            return;
        }

        const metadata = JSON.parse(fs.readFileSync(this.avzDir + "/metadata.json", "utf8")) as { compileOptions: string };
        const customOptions = vscode.workspace.getConfiguration().get<string[]>("avzConfigure.compileOptions")!;
        const compileOptions = metadata.compileOptions.replaceAll("__CUSTOM_ARGS__", customOptions.join(" "));
        const command = vscode.workspace.getConfiguration().get<string>("avzConfigure.avzRunScriptCmd")!
            .replaceAll("__COMPILER_CMD__", compileOptions)
            .replaceAll("__AVZ_DIR__", this.avzDir)
            .replaceAll("__FILE_NAME__", vscode.window.activeTextEditor.document.fileName);

        await Avz.execute("taskkill /f /im gdb32.exe"); // 杀死之前运行的调试器进程

        if (!isMaskCmd) {
            this.runCmd(command);
            return;
        }
        const [err] = await Avz.execute(command);
        if (err !== null) {
            vscode.window.showErrorMessage(vscode.l10n.t("Failed to run script. ({error})", { error: err.message }));
        } else {
            vscode.window.showInformationMessage(vscode.l10n.t("Script was injected successfully."));
        }
    }


    public runScriptInTerminal(): void {
        this.runScripImp(false);
    }


    public runScriptMaskCmd(): void {
        this.runScripImp(true);
    }


    public buildAvz(): void {
        if (!Avz.hasOpenFolder()) {
            return;
        }
        if ((this.avzDir === "") && !this.setAvzDir()) {
            return;
        }

        const progressBuild = async (progress: vscode.Progress<{ message?: string; increment?: number; }>) => {
            // encoding 默认为 "utf8", 但仍显式给出, 以匹配返回 string[] 的重载
            const srcFiles = fs.readdirSync(this.avzDir + "/src", { encoding: "utf8", recursive: true }).filter(entryName => entryName.endsWith(".cpp"));
            const srcFileCnt = srcFiles.length;
            if (srcFileCnt === 0) {
                throw new Error("Source files not found");
            }
            const customOptions = vscode.workspace.getConfiguration().get<string[]>("avzConfigure.compileOptions")!;
            const compileCmd = templateStrs.getAvzCompileCommand(this.avzDir, this.envType).replaceAll("__CUSTOM_ARGS__", customOptions.join(" "));
            const cpuCnt = os.availableParallelism();
            const increment = (1 / srcFileCnt) * 100;
            let finishCnt = 0;

            // 多进程加速编译
            const worker = async (taskList: number[]) => {
                for (const idx of taskList) {
                    const srcFile = srcFiles[idx];
                    const command = compileCmd.replaceAll("__FILE_NAME__", `${this.avzDir}/src/${srcFile}`);
                    const [err] = await Avz.execute(command);
                    if (err !== null) { // 继续编译
                        vscode.window.showWarningMessage(vscode.l10n.t("Failed to compile file \"{file}\". ({error})", { file: srcFile, error: err.message }));
                    }
                    const percent = Math.round((++finishCnt / srcFileCnt) * 100);
                    progress.report({
                        message: `${percent}%`,
                        increment: increment
                    });
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

            const objFilePaths = srcFiles.map(srcFile => `${this.avzDir}/src/${srcFile}.o`).filter(path => fs.existsSync(path));
            execSync(templateStrs.getAvzPackCommand(this.avzDir, objFilePaths)); // may throw
            for (const path of objFilePaths) {
                fs.unlinkSync(path);
            }
        };

        const progressOptions: vscode.ProgressOptions = {
            location: vscode.ProgressLocation.Notification,
            cancellable: false,
            title: vscode.l10n.t("AvZ library being compiled")
        };
        vscode.window.withProgress(progressOptions, progressBuild).then(
            () => { vscode.window.showInformationMessage(vscode.l10n.t("AvZ was built successfully.")); },
            (reason: Error) => { vscode.window.showErrorMessage(vscode.l10n.t("Failed to build AvZ. ({error})", { error: reason.message })); }
        );
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


    public async updateAvz(): Promise<void> {
        if (!Avz.hasOpenFolder()) {
            return;
        }
        if ((this.avzDir === "") && !this.setAvzDir()) {
            return;
        }

        const downloadSrc = vscode.workspace.getConfiguration().get<string>("avzConfigure.downloadSource")!;

        // 下载版本列表
        const avzVersionTxtUrl = `${Avz.avzRepoUrl.get(downloadSrc)}/release/version.txt`;
        const avzVersionTxtPath = this.tmpDir + "/version.txt";
        const avzVersion = await fileUtils.downloadToPick(avzVersionTxtUrl, avzVersionTxtPath, vscode.l10n.t("Select AvZ Version"), (version) => version.startsWith(`env${this.envType}`));

        // 下载 AvZ 压缩包
        const avzFileUrl = `${Avz.avzRepoUrl.get(downloadSrc)}/release/${avzVersion}`;
        const avzFilePath = this.tmpDir + "/avz.zip";
        await fileUtils.downloadFile(avzFileUrl, avzFilePath, true);

        execSync(`"${this.avzDir}/7z/7z.exe" x "${avzFilePath}" -aoa -o"${this.avzDir}"`);
        vscode.window.showInformationMessage(vscode.l10n.t("AvZ was updated successfully."));
        this.recommendClangd();
    }


    private refreshAvzVersion(): void {
        if (this.avzVersion !== "") {
            return;
        }
        const lines = fileUtils.readFile(this.avzDir + "/inc/libavz.h");
        for (const line of lines) {
            if (line.includes("__AVZ_VERSION__")) {
                const version = line.split(" ")[2];
                this.avzVersion = `20${version.substring(0, 2)}_${version.substring(2, 4)}_${version.substring(4, 6)}`;
                return;
            }
        }
    }


    public getAvzInfo(): void {
        if (!Avz.hasOpenFolder()) {
            return;
        }
        if ((this.avzDir === "") && !this.setAvzDir()) {
            return;
        }
        this.refreshAvzVersion();
        vscode.window.showInformationMessage(`AvZ ${this.envType} ${this.avzVersion}`);
    }


    private refreshExtensionList(): void {
        if (this.extensionInstalledList.size > 0) {
            return;
        }
        const entrys = fs.readdirSync(this.avzDir + "/inc", { withFileTypes: true });
        for (const entry of entrys) { // 读取已经安装的插件列表
            if (entry.isDirectory()) {
                this.extensionInstalledList.add(entry.name);
            }
        }
    }


    public async getAvzExtension(): Promise<void> {
        if (!Avz.hasOpenFolder()) {
            return;
        }
        if ((this.avzDir === "") && !this.setAvzDir()) {
            return;
        }
        this.refreshExtensionList();
        const downloadSrc = vscode.workspace.getConfiguration().get<string>("avzConfigure.downloadSource")!;

        const extensionListUrl = `${Avz.extensionRepoUrl.get(downloadSrc)}/extension_list.txt`;
        const extensionListPath = this.tmpDir + "/extension_list.txt";
        const fullName = await fileUtils.downloadToPick(extensionListUrl, extensionListPath, vscode.l10n.t("Select Extension"));

        const versionTxtUrl = `${Avz.extensionRepoUrl.get(downloadSrc)}/${fullName}/version.txt`;
        const versionTxtPath = this.tmpDir + "/version.txt";
        const version = await fileUtils.downloadToPick(versionTxtUrl, versionTxtPath, vscode.l10n.t("Select Version"));

        await this.installExtension(fullName, version, true);
    }


    private getExtensionFullName(name: string): string | undefined {
        const extensionListPath = this.tmpDir + "/extension_list.txt";
        const extensionList = fileUtils.readFile(extensionListPath).map(line => line.trimEnd());
        return extensionList.find(fullName => fullName.endsWith("/" + name));
    }


    private async installExtension(extensionFullName: string, extensionVersion: string, isForceInstall: boolean = false): Promise<void> {
        const extensionName = extensionFullName.split("/")[1];
        const hasInstalled = this.extensionInstalledList.has(extensionName);
        if (hasInstalled && !isForceInstall) {
            vscode.window.showWarningMessage(vscode.l10n.t("You have already installed the extension \"{0}\", so it will not be installed again. If you encounter version compatibility issues, please manually install another version of the extension; if you can't solve the problem, please contact the author of the extension.", extensionName));
            return;
        }
        const downloadSrc = vscode.workspace.getConfiguration().get<string>("avzConfigure.downloadSource")!;
        const extensionUrl = `${Avz.extensionRepoUrl.get(downloadSrc)}/${extensionFullName}/release/${extensionVersion}.zip`;
        const extensionPath = this.tmpDir + "/extension.zip";
        await fileUtils.downloadFile(extensionUrl, extensionPath, true);
        execSync(`"${this.avzDir}/7z/7z.exe" x "${extensionPath}" -aoa -o"${this.avzDir}/inc"`);
        vscode.window.showInformationMessage(vscode.l10n.t("Extension \"{0}\" was installed successfully.", extensionName));

        if (!hasInstalled) {
            this.extensionInstalledList.add(extensionName);
        }

        // 读取插件的依赖列表
        const lines = fileUtils.readFile(`${this.avzDir}/inc/${extensionName}/information.txt`).map(line => line.trim());
        for (const [lineNum, line] of lines.entries()) {
            if (lineNum === 1) { // AvZ Version
                this.refreshAvzVersion();
                const needAvzVersion = line.split(" ")[1];
                if (!needAvzVersion.includes(this.avzVersion)) {
                    vscode.window.showWarningMessage(vscode.l10n.t("The extension \"{0}\" you downloaded depends on AvZ version {1}, but the current AvZ version is {2}, which may cause an incompatibility issue!", extensionName, needAvzVersion, this.avzVersion));
                }
            } else if (lineNum > 1) {
                const [name, version] = line.split(" ");
                const fullName = this.getExtensionFullName(name);
                if (fullName !== undefined) {
                    await this.installExtension(fullName, version);
                } else {
                    vscode.window.showErrorMessage(vscode.l10n.t("Extension \"{0}\" not found.", name));
                }
            }
        }
    }
}
