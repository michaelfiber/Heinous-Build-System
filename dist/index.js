"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HeinousBuild = void 0;
const fs_1 = require("fs");
const path_1 = require("path");
async function HeinousBuild() {
    let configPath = path_1.join(process.cwd(), "rewrite.config.json");
    if (!fs_1.existsSync(configPath)) {
        console.log('No config. Please create a rewrite.config.json file in the base of your project and fill it with a data structure that describes the rewrites you would like.');
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
                "fetchFrom": "./node_modules/socket.io-client/dist/socket.io.min.js"
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
    console.log('Watching: \x1b[1m' + srcDirPath + '\x1b[0m');
    console.log('Putting modified files in: \x1b[1m' + destDirPath + '\x1b[0m');
    const processFile = (event, file) => {
        if (!fs_1.existsSync(destDirPath))
            fs_1.mkdirSync(destDirPath);
        let filePath = path_1.join(srcDirPath, file);
        let fileOutputPath = path_1.join(destDirPath, file);
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
    };
    // on start process all the JS files in the dir.
    for (let file of fs_1.readdirSync(srcDirPath)) {
        processFile(null, file);
    }
    fs_1.watch(srcDirPath, processFile);
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