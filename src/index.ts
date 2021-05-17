import fs, { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, watch, writeFileSync } from "fs";
import { join } from "path";

export async function HeinousBuild() {

    let configPath = join(process.cwd(), "rewrite.config.json");

    if (!existsSync(configPath)) {
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

    let srcDirPath = join(process.cwd(), config.src);
    let destDirPath = join(process.cwd(), config.dest);

    if (!existsSync(srcDirPath)) mkdirSync(srcDirPath);
    if (!existsSync(destDirPath)) mkdirSync(destDirPath);

    console.log('Watching: \x1b[1m' + srcDirPath + '\x1b[0m');
    console.log('Putting modified files in: \x1b[1m' + destDirPath + '\x1b[0m');

    const processFile = (event: any, file: string) => {
        if (!existsSync(destDirPath)) mkdirSync(destDirPath);

        let filePath = join(srcDirPath, file);
        let fileOutputPath = join(destDirPath, file);

        if (!file.toLowerCase().endsWith('.js')) {
            let srcStat;
            try {
                srcStat = statSync(filePath);
            } catch (ex) {
                if (ex.code == 'ENOENT') return;
            }

            let shouldCopy = false;

            let destStat;

            try {
                destStat = statSync(fileOutputPath);
            } catch (ex) {
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
                copyFileSync(filePath, fileOutputPath);
            }

            return;
        }

        let fileContentsBuffer = readFileSync(filePath);
        let fileContents = fileContentsBuffer.toString();

        let shouldWrite = false;

        for (let aliasTarget of Object.keys(config.map)) {
            let importRegex = new RegExp("(?<=import[^']*')(" + aliasTarget + ")(?=';\n)", 'ig');
            let fullLine = new RegExp("import[^']*'" + aliasTarget + "';\n", 'ig');


            if (fileContents.match(importRegex)) {
                if (fileContents.match(importRegex) && config.map[aliasTarget].fetchFrom) {
                    let copyFromPath = join(process.cwd(), config.map[aliasTarget].fetchFrom);
                    let parts = config.map[aliasTarget].fetchFrom.split('/');
                    let copyToPath = join(destDirPath, parts[parts.length - 1]);

                    try {
                        copyFileSync(copyFromPath, copyToPath)
                    } catch (ex) {
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
                } else {
                    fileContents = fileContents.replace(importRegex, config.map[aliasTarget].rewrite);
                    shouldWrite = true;
                }

            }
        }

        if (shouldWrite) {
            console.log(`[${new Date().toLocaleString()}] updated ${filePath}`)
        }
        writeFileSync(fileOutputPath, fileContents);
    }

    // on start process all the JS files in the dir.
    for (let file of readdirSync(srcDirPath)) {
        processFile(null, file);
    }

    watch(srcDirPath, processFile);

    // handle file copies - copy on start and then watch for changes.
    if (config.copy) {
        for (let srcCopyRelativePath of config.copy as string[]) {
            let srcCopyFullPath = join(process.cwd(), srcCopyRelativePath);
            try {
                let stat = statSync(srcCopyFullPath)
            } catch (ex) {
                if (ex.code == 'ENOENT') continue;
            }

            let parts = srcCopyRelativePath.split('/');

            let destCopyFullPath = join(destDirPath, parts[parts.length - 1]);

            copyFileSync(srcCopyFullPath, destCopyFullPath);

            watch(srcCopyFullPath, (event, filename) => {
                try {
                    let stat = statSync(srcCopyFullPath);
                } catch (ex) {
                    if (ex.code == 'ENOENT') return;
                }
                copyFileSync(srcCopyFullPath, destCopyFullPath);
            });
        }
    }
}