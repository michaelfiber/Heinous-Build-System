"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HeinousBuild = void 0;
const fs_1 = require("fs");
const path_1 = require("path");
async function HeinousBuild() {
    let configPathExists = true;
    let configPath = path_1.join(process.cwd(), "rewrite.config.json");
    if (!fs_1.existsSync(configPath)) {
        configPath = path_1.join(process.cwd(), "heinous.json");
        if (!fs_1.existsSync(configPath)) {
            configPathExists = false;
        }
    }
    if (!configPathExists) {
        console.log('No config. Please create a rewrite.config.json or heinous.json file in the base of your project and fill it with a data structure that describes the rewrites you would like.');
        console.log(`
Example:

    {
        "src": "build",
        "dest": "dist",
        "map": {
            "vue": {
                "rewrite": "./vue.esm.browser.min.js",
                "fetchFrom": "./node_modules/vue/dist/vue.esm.browser.min.js"
            },
            "socket.io-client": {
                "remove": true,
                "fetchFrom": "./node_modules/socket.io-client/dist/socket.io.min.js",
                "placeIn": "client"
            }
        },
        "copy": [
            "./static/index.html"
        ]
    }
`);
        return;
    }
    let config = require(configPath);
    let srcDirPath = path_1.join(process.cwd(), config.src);
    let destDirPath = path_1.join(process.cwd(), config.dest);
    if (!fs_1.existsSync(srcDirPath))
        fs_1.mkdirSync(srcDirPath);
    if (!fs_1.existsSync(destDirPath))
        fs_1.mkdirSync(destDirPath);
    let watchedDirectories = [{ src: srcDirPath, dest: destDirPath }];
    function processFile(event, file, srcPath, destPath) {
        if (!fs_1.existsSync(destPath))
            fs_1.mkdirSync(destPath);
        let filePath = path_1.join(srcPath, file);
        let fileOutputPath = path_1.join(destPath, file);
        if (!file.toLowerCase().endsWith('.js')) {
            let srcStat;
            try {
                srcStat = fs_1.statSync(filePath);
            }
            catch (ex) {
                if (ex.code == 'ENOENT')
                    return;
            }
            let shouldCopy = false;
            let destStat;
            try {
                destStat = fs_1.statSync(fileOutputPath);
            }
            catch (ex) {
                if (ex.code == 'ENOENT') {
                    shouldCopy = true;
                }
            }
            if (destStat && srcStat) {
                if (destStat.mtime !== srcStat.mtime || destStat.size !== srcStat.size) {
                    shouldCopy = true;
                }
            }
            if (shouldCopy) {
                console.log(`[${new Date().toLocaleString()}] copying unmodified file ${filePath}`);
                fs_1.copyFileSync(filePath, fileOutputPath);
            }
            return;
        }
        let fileContentsBuffer = fs_1.readFileSync(filePath);
        let fileContents = fileContentsBuffer.toString();
        let shouldWrite = false;
        for (let aliasTarget of Object.keys(config.map)) {
            let importRegex = new RegExp("(?<=import[^']*')(" + aliasTarget + ")(?=';\n)", 'ig');
            let fullLine = new RegExp("import[^']*'" + aliasTarget + "';\n", 'ig');
            if (fileContents.match(importRegex)) {
                if (fileContents.match(importRegex) && config.map[aliasTarget].fetchFrom) {
                    let copyFromPath = path_1.join(process.cwd(), config.map[aliasTarget].fetchFrom);
                    let parts = config.map[aliasTarget].fetchFrom.split('/');
                    let copyToPath = path_1.join(destDirPath, parts[parts.length - 1]);
                    if (config.map[aliasTarget].placeIn) {
                        copyToPath = path_1.join(destDirPath, config.map[aliasTarget].placeIn, parts[parts.length - 1]);
                    }
                    try {
                        fs_1.copyFileSync(copyFromPath, copyToPath);
                    }
                    catch (ex) {
                        if (ex.code == 'ENOENT') {
                            console.log(`[${new Date().toLocaleString()}] \x1b[41m\x1b[1m  Could not copy ${config.map[aliasTarget].fetchFrom}. Is it installed?  \x1b[0m`);
                        }
                    }
                }
                if (config.map[aliasTarget].remove) {
                    let matches = fileContents.match(fullLine);
                    if (matches && matches.length > 0) {
                        fileContents = fileContents.replace(matches[0], '');
                        shouldWrite = true;
                    }
                }
                else {
                    fileContents = fileContents.replace(importRegex, config.map[aliasTarget].rewrite);
                    shouldWrite = true;
                }
            }
        }
        if (shouldWrite) {
            console.log(`[${new Date().toLocaleString()}] updated ${filePath}`);
        }
        fs_1.writeFileSync(fileOutputPath, fileContents);
    }
    // on start process all the JS files in the main src dir.
    function processDir(srcDir, destDir) {
        for (let file of fs_1.readdirSync(srcDir)) {
            let isDir = false;
            let stat;
            try {
                stat = fs_1.statSync(path_1.join(srcDir, file));
            }
            catch (ex) {
                if (ex.code == 'EISDIR') {
                    isDir = true;
                }
            }
            if ((stat && stat.isFile()))
                processFile(null, file, srcDir, destDir);
            else if ((stat && stat.isDirectory()) || isDir) {
                let newSrcDir = path_1.join(srcDir, file);
                let newDestDir = path_1.join(destDir, file);
                // add to watchedDirectories if it isn't already there.
                let existing = watchedDirectories.filter(d => d.src == newSrcDir);
                if (existing.length == 0) {
                    watchedDirectories.push({
                        src: newSrcDir,
                        dest: newDestDir
                    });
                }
                processDir(newSrcDir, newDestDir);
            }
        }
    }
    processDir(srcDirPath, destDirPath);
    for (let watchedDir of watchedDirectories) {
        console.log('Watching: \x1b[1m' + watchedDir.src + '\x1b[0m');
        console.log('Putting modified files in: \x1b[1m' + watchedDir.dest + '\x1b[0m');
        fs_1.watch(watchedDir.src, (event, file) => { processFile(event, file, watchedDir.src, watchedDir.dest); });
    }
    // handle file copies - copy on start and then watch for changes.
    if (config.copy) {
        for (let srcCopyRelativePath of config.copy) {
            let srcCopyFullPath = path_1.join(process.cwd(), srcCopyRelativePath);
            try {
                let stat = fs_1.statSync(srcCopyFullPath);
            }
            catch (ex) {
                if (ex.code == 'ENOENT')
                    continue;
            }
            let parts = srcCopyRelativePath.split('/');
            let destCopyFullPath = path_1.join(destDirPath, parts[parts.length - 1]);
            fs_1.copyFileSync(srcCopyFullPath, destCopyFullPath);
            fs_1.watch(srcCopyFullPath, (event, filename) => {
                try {
                    let stat = fs_1.statSync(srcCopyFullPath);
                }
                catch (ex) {
                    if (ex.code == 'ENOENT')
                        return;
                }
                fs_1.copyFileSync(srcCopyFullPath, destCopyFullPath);
            });
        }
    }
}
exports.HeinousBuild = HeinousBuild;
//# sourceMappingURL=index.js.map