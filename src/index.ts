import fs, { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, watch, writeFileSync } from "fs";
import { join } from "path";

export async function HeinousBuild() {

    let configPathExists = true;

    let configPath = join(process.cwd(), "rewrite.config.json");
    if (!existsSync(configPath)) {
        configPath = join(process.cwd(), "heinous.json");
        if (!existsSync(configPath)) {
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

    let srcDirPath = join(process.cwd(), config.src);
    let destDirPath = join(process.cwd(), config.dest);

    if (!existsSync(srcDirPath)) mkdirSync(srcDirPath);
    if (!existsSync(destDirPath)) mkdirSync(destDirPath);

    let watchedDirectories: Array<{ src: string, dest: string }> = [{ src: srcDirPath, dest: destDirPath }];

    function processFile(event: any, file: string, srcPath: string, destPath: string) {
        if (!existsSync(destPath)) mkdirSync(destPath);

        let filePath = join(srcPath, file);
        let fileOutputPath = join(destPath, file);

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

                    if (config.map[aliasTarget].placeIn) {
                        copyToPath = join(destDirPath, config.map[aliasTarget].placeIn, parts[parts.length - 1]);
                    }

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

    // on start process all the JS files in the main src dir.
    function processDir(srcDir: string, destDir: string) {
        for (let file of readdirSync(srcDir)) {
            let isDir = false;
            let stat;

            try {
                stat = statSync(join(srcDir, file));
            } catch (ex) {
                if (ex.code == 'EISDIR') {
                    isDir = true;
                }
            }

            if ((stat && stat.isFile())) processFile(null, file, srcDir, destDir);
            else if ((stat && stat.isDirectory()) || isDir) {
                let newSrcDir = join(srcDir, file);
                let newDestDir = join(destDir, file);

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

        watch(watchedDir.src, (event, file) => { processFile(event, file, watchedDir.src, watchedDir.dest) });
    }


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