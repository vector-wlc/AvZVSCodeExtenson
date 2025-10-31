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

import * as child_process from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as util from 'util';
import * as vscode from 'vscode';
import * as fileUtils from './file_utils';
import * as templateStrs from './template_strs';

type RepoType = "GitHub" | "GitLab" | "Gitee";

const CLANGD_EXTENSION_ID = "llvm-vs-code-extensions.vscode-clangd";

const exec = util.promisify(child_process.exec);

const execSync = (command: string): string => child_process.execSync(command, { encoding: "utf8" });

export class Avz {
    private static readonly avzRepoUrl: Readonly<Record<RepoType, string>> = {
        "GitHub": "https://github.com/vector-wlc/AsmVsZombies/raw/master",
        "GitLab": "https://gitlab.com/vector-wlc/AsmVsZombies/-/raw/master",
        "Gitee": "https://gitee.com/vector-wlc/AsmVsZombies/raw/master",
    };
    private static readonly extensionRepoUrl: Readonly<Record<RepoType, string>> = {
        "GitHub": "https://github.com/qrmd0/AvZLib/raw/main",
        "GitLab": "https://gitlab.com/avzlib/AvZLib/-/raw/main",
        "Gitee": "https://gitee.com/qrmd/AvZLib/raw/main",
    };

    private readonly tmpDir: string = os.tmpdir() + "/AsmVsZombies";
    private avzDir = "";
    private avzTerminal: vscode.Terminal | undefined = vscode.window.terminals.find(terminal => terminal.name === "AvZ");
    private avzVersion = "";
    private envType = 0;
    private extensionInstalledList = new Set<string>();

    constructor() {
        fileUtils.mkdir(this.tmpDir);
    }


    private static hasOpenFolder(): boolean {
        if (vscode.workspace.workspaceFolders) {
            return true;
        }
        vscode.window.showErrorMessage(vscode.l10n.t("You must have the folder open to execute the AvZ command!"));
        return false;
    }


    private createConfigFiles(): void {
        const projectDir = vscode.workspace.workspaceFolders![0].uri.fsPath;
        fileUtils.mkdir(projectDir + "/bin");
        fileUtils.mkdir(projectDir + "/.vscode");
        fileUtils.writeFile(projectDir + "/.vscode/c_cpp_properties.json", templateStrs.generateCCppJson(this.avzDir, this.envType), false);
        fileUtils.writeFile(projectDir + "/.vscode/settings.json", templateStrs.generateSettingsJson(this.avzDir, this.envType), false);
        fileUtils.writeFile(projectDir + "/.vscode/tasks.json", templateStrs.generateTasksJson(this.avzDir, this.envType), false);
        fileUtils.writeFile(projectDir + "/.vscode/launch.json", templateStrs.generateLaunchJson(this.avzDir, this.envType), false);
        if (vscode.extensions.getExtension(CLANGD_EXTENSION_ID)) {
            fileUtils.writeFile(projectDir + "/.clang-format", templateStrs.generateClangFormat(this.avzDir, this.envType), false);
        }
        fileUtils.writeFile(this.avzDir + "/metadata.json", templateStrs.generateMetadataJson(this.avzDir, this.envType), false);
    }


    /**
     * @retval true: 成功设置 AvZ 目录
     * @retval false: 失败
     */
    private setAvzDir(dirPath: string, isManual: boolean = false): boolean {
        if (!Avz.hasOpenFolder()) {
            return false;
        }

        let rootPath = dirPath.replaceAll("\\", "/");
        if (rootPath.endsWith("/")) {
            rootPath = rootPath.slice(0, -1);
        }
        const paths = [rootPath].concat(isManual ? fs.readdirSync(rootPath).map(entryName => rootPath + "/" + entryName) : []);
        for (const path of paths) {
            if (!fs.existsSync(path + "/MinGW")) { // 确定 AsmVsZombies 子目录
                continue;
            }
            this.avzDir = path;
            this.envType = fs.existsSync(this.avzDir + "/MinGW/bin/libLLVM-15.dll") ? 2 : 1;
            this.createConfigFiles();
            vscode.workspace.getConfiguration().update("avzConfigure.avzDir", this.avzDir, false);
            if (isManual) {
                vscode.window.showInformationMessage(vscode.l10n.t("AvZ installation directory has been found: {0}", this.avzDir));
            }
            return true;
        }
        const message = vscode.l10n.t("The valid AvZ installation directory was not found, try resetting AvZ directory.");
        const option = vscode.l10n.t("Set AvZ directory");
        vscode.window.showErrorMessage(message, option).then(selection => {
            if (selection === option) {
                this.selectAvzFolder();
            }
        });
        return false;
    }


    public selectAvzFolder(): void {
        if (!Avz.hasOpenFolder()) {
            return;
        }
        vscode.window.showOpenDialog({
            canSelectFolders: true,
            canSelectFiles: false,
            canSelectMany: false,
            openLabel: vscode.l10n.t("Select AvZ installed directory")
        }).then(folders => {
            if (folders && folders.length > 0) {
                this.setAvzDir(folders[0].fsPath, true);
            }
        });
    }


    private refreshAvzDir(): boolean {
        if (this.avzDir !== "") {
            return true;
        }
        if (!Avz.hasOpenFolder()) {
            return false;
        }
        let dirPath = vscode.workspace.getConfiguration().get<string>("avzConfigure.avzDir")!;
        if (dirPath === "") {
            dirPath = vscode.workspace.workspaceFolders![0].uri.fsPath;
        }
        return this.setAvzDir(dirPath);
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
        if (!this.refreshAvzDir()) {
            return;
        }
        if (!vscode.window.activeTextEditor) {
            vscode.window.showErrorMessage(vscode.l10n.t("Please open the script file that needs to be run"));
            return;
        }
        if (!(await vscode.window.activeTextEditor.document.save())) {
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

        try {
            await exec("taskkill /f /im gdb32.exe"); // 杀死之前运行的调试器进程
        } catch { }

        if (!isMaskCmd) {
            this.runCmd(command);
            return;
        }
        try {
            await exec(command);
            vscode.window.showInformationMessage(vscode.l10n.t("Script was compiled successfully."));
        } catch (e) {
            vscode.window.showErrorMessage(vscode.l10n.t("Failed to compile script ({error})", { error: (e as Error).message }));
        }
    }


    public runScriptInTerminal(): void {
        this.runScripImp(false);
    }


    public runScriptMaskCmd(): void {
        this.runScripImp(true);
    }


    public buildAvz(): void {
        if (!this.refreshAvzDir()) {
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

            // 每个进程的任务
            const worker = async (taskList: number[]) => {
                for (const idx of taskList) {
                    const srcFile = srcFiles[idx];
                    const command = compileCmd.replaceAll("__FILE_NAME__", `${this.avzDir}/src/${srcFile}`);
                    try {
                        await exec(command);
                    } catch (e) {
                        throw new Error(`Failed to compile "${srcFile}": ${(e as Error).message}`);
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

            await Promise.all(taskTable.map(worker));

            try {
                fs.unlinkSync(this.avzDir + "/bin/libavz.a");
            } catch { }

            await exec(templateStrs.getAvzPackCommand(this.avzDir)); // pack & clean
        };

        const progressOptions: vscode.ProgressOptions = {
            location: vscode.ProgressLocation.Notification,
            cancellable: false,
            title: vscode.l10n.t("AvZ library being compiled")
        };
        vscode.window.withProgress(progressOptions, progressBuild).then(
            () => { vscode.window.showInformationMessage(vscode.l10n.t("AvZ was built successfully.")); },
            (reason: Error) => {
                vscode.window.showErrorMessage(vscode.l10n.t("Failed to build AvZ ({error})", { error: reason.message }));
            }
        );
    }


    public getPvzExePath(): string {
        const pvzExeName = vscode.workspace.getConfiguration().get<string>("avzConfigure.pvzExeName")!;
        const output = execSync(`wmic process where name="${pvzExeName}" get ExecutablePath`);
        const exePath = output.split("\n")[1].trim();
        if (exePath === "") {
            vscode.window.showErrorMessage(vscode.l10n.t("PvZ is not activated!"));
        } else {
            vscode.window.showInformationMessage(vscode.l10n.t("Executable path of PvZ has been found: {0}", exePath));
        }
        return exePath;
    }


    public getPvzProcessId(): string {
        const pvzExeName = vscode.workspace.getConfiguration().get<string>("avzConfigure.pvzExeName")!;
        const output = execSync(`wmic process where name="${pvzExeName}" get ProcessId`);
        const pid = output.split("\n")[1].trim();
        if (pid === "") {
            vscode.window.showErrorMessage(vscode.l10n.t("PvZ is not activated!"));
        } else {
            vscode.window.showInformationMessage(vscode.l10n.t("Process ID of PvZ has been found: {0}", pid));
        }
        return pid;
    }


    private recommendClangd(): void {
        if (this.envType === 1 // AvZ 1 环境包中不包含 clangd
            || vscode.extensions.getExtension(CLANGD_EXTENSION_ID)) {
            return;
        }
        const message = vscode.l10n.t("It is recommended to install the clangd extension for a better code hinting and formatting experience.");
        const option = vscode.l10n.t("Install");
        vscode.window.showInformationMessage(message, option).then(selection => {
            if (selection === option) {
                vscode.commands.executeCommand("extension.open", CLANGD_EXTENSION_ID);
            }
        });
    }


    public async updateAvz(): Promise<void> {
        if (!this.refreshAvzDir()) {
            return;
        }
        const downloadSrc = vscode.workspace.getConfiguration().get<RepoType>("avzConfigure.downloadSource")!;

        // 下载版本列表
        const avzVersionListUrl = `${Avz.avzRepoUrl[downloadSrc]}/release/version.txt`;
        const avzVersionListPath = this.tmpDir + "/version.txt";
        const avzVersion = await fileUtils.downloadToPick(
            avzVersionListUrl,
            avzVersionListPath,
            vscode.l10n.t("Select AvZ Version"),
            (version) => version.startsWith(`env${this.envType}`)
        ).then(
            (selection) => selection,
            (err: Error) => {
                vscode.window.showErrorMessage(vscode.l10n.t("Failed to get the list of AvZ versions ({error})", { error: err.message }));
                return undefined;
            }
        );
        if (!avzVersion) {
            return;
        }

        // 下载 AvZ 压缩包
        const avzFileUrl = `${Avz.avzRepoUrl[downloadSrc]}/release/${avzVersion}`;
        const avzFilePath = this.tmpDir + "/avz.zip";
        try {
            await fileUtils.downloadFile(avzFileUrl, avzFilePath, true);
        } catch (e) {
            vscode.window.showErrorMessage(vscode.l10n.t("Failed to download AvZ package ({error})", { error: (e as Error).message }));
            return;
        }

        await Promise.allSettled([
            fs.promises.rm(this.avzDir + "/inc", { recursive: true, force: true }),
            fs.promises.rm(this.avzDir + "/src", { recursive: true, force: true }),
        ]);
        await exec(`"${this.avzDir}/7z/7z.exe" x "${avzFilePath}" -aoa -o"${this.avzDir}"`);
        vscode.window.showInformationMessage(vscode.l10n.t("AvZ was updated successfully."));
        this.recommendClangd();
    }


    private refreshAvzVersion(): boolean {
        if (this.avzVersion !== "") {
            return true;
        }
        const lines = fileUtils.readFileLines(this.avzDir + "/inc/libavz.h");
        for (const line of lines) {
            if (line.includes("__AVZ_VERSION__")) {
                const version = line.split(" ")[2];
                this.avzVersion = `20${version.substring(0, 2)}_${version.substring(2, 4)}_${version.substring(4, 6)}`;
                return true;
            }
        }
        return false;
    }


    public showAvzInfo(): void {
        if (!this.refreshAvzDir()) {
            return;
        }
        this.refreshAvzVersion();
        let info = `AvZ ${this.envType} | ${this.avzVersion} | "${this.avzDir}"`;
        if (this.envType === 2) {
            const cpu = execSync(`${this.avzDir}/MinGW/bin/g++ -dumpmachine`).split("-", 1)[0];
            info += " | " + cpu;
        }
        vscode.window.showInformationMessage(info);
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


    public async fetchAvzExtension(): Promise<void> {
        if (!this.refreshAvzDir()) {
            return;
        }
        this.refreshExtensionList();
        const downloadSrc = vscode.workspace.getConfiguration().get<RepoType>("avzConfigure.downloadSource")!;

        const extensionListUrl = `${Avz.extensionRepoUrl[downloadSrc]}/extension_list.txt`;
        const extensionListPath = this.tmpDir + "/extension_list.txt";
        const fullName = await fileUtils.downloadToPick(extensionListUrl, extensionListPath, vscode.l10n.t("Select Extension")).then(
            (selection) => selection,
            (err: Error) => {
                vscode.window.showErrorMessage(vscode.l10n.t("Failed to get the list of extensions ({error})", { error: err.message }));
                return undefined;
            }
        );
        if (!fullName) {
            return
        }

        const versionListUrl = `${Avz.extensionRepoUrl[downloadSrc]}/${fullName}/version.txt`;
        const versionListPath = this.tmpDir + "/version.txt";
        const version = await fileUtils.downloadToPick(versionListUrl, versionListPath, vscode.l10n.t("Select Version")).then(
            (selection) => selection,
            (err: Error) => {
                vscode.window.showErrorMessage(vscode.l10n.t("Failed to get the list of extension versions ({error})", { error: err.message }));
                return undefined;
            }
        );
        if (!version) {
            return;
        }

        await this.downloadAvzExtension(fullName, version, true);
    }


    private getExtensionFullName(name: string): string | undefined {
        const extensionListPath = this.tmpDir + "/extension_list.txt";
        const extensionList = fileUtils.readFileLines(extensionListPath).map(line => line.trimEnd());
        return extensionList.find(fullName => fullName.endsWith("/" + name));
    }


    private async downloadAvzExtension(extensionFullName: string, extensionVersion: string, isForceInstall: boolean = false): Promise<void> {
        const extensionName = extensionFullName.split("/")[1];
        const hasInstalled = this.extensionInstalledList.has(extensionName);
        if (hasInstalled && !isForceInstall) {
            vscode.window.showWarningMessage(vscode.l10n.t('You have already installed the extension "{0}", so it will not be installed again. If you encounter version compatibility issues, please manually install another version of the extension; if you cannot solve the problem, please contact the author of the extension.', extensionName));
            return;
        }

        const downloadSrc = vscode.workspace.getConfiguration().get<RepoType>("avzConfigure.downloadSource")!;
        const extensionUrl = `${Avz.extensionRepoUrl[downloadSrc]}/${extensionFullName}/release/${extensionVersion}.zip`;
        const extensionPath = this.tmpDir + "/extension.zip";
        try {
            await fileUtils.downloadFile(extensionUrl, extensionPath, true);
        } catch (e) {
            vscode.window.showErrorMessage(vscode.l10n.t('Failed to download extension "{name}" ({error})', { name: extensionName, error: (e as Error).message }));
            return;
        }

        await exec(`"${this.avzDir}/7z/7z.exe" x "${extensionPath}" -aoa -o"${this.avzDir}/inc"`);
        if (!hasInstalled) {
            this.extensionInstalledList.add(extensionName);
        }
        vscode.window.showInformationMessage(vscode.l10n.t('Extension "{0}" was installed successfully.', extensionName));

        // 读取插件的依赖列表
        const lines = fileUtils.readFileLines(`${this.avzDir}/inc/${extensionName}/information.txt`);
        for (const [lineNum, line] of lines.entries()) {
            if (lineNum === 1) { // AvZ Version
                this.refreshAvzVersion();
                const avzVersionNeeded = line.split(" ")[1];
                if (!avzVersionNeeded.includes(this.avzVersion)) {
                    vscode.window.showWarningMessage(vscode.l10n.t('The extension "{0}" you downloaded depends on AvZ version {1}, but the current AvZ version is {2}, which may cause an incompatibility issue!', extensionName, avzVersionNeeded, this.avzVersion));
                }
            } else if (lineNum > 1) {
                const [name, version] = line.split(" ");
                const fullName = this.getExtensionFullName(name);
                if (fullName) {
                    await this.downloadAvzExtension(fullName, version);
                } else {
                    vscode.window.showErrorMessage(vscode.l10n.t('Extension "{0}" not found.', name));
                }
            }
        }
    }
}
