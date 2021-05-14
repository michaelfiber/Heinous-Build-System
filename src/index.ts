import fs, { copyFileSync, existsSync, watch } from "fs";
import { join } from "path";

export async function HeinousBuild() {

    let configPath = join(process.cwd(), "rewrite.config.json");

    if (!existsSync(configPath)) {
        console.log('no config');
        return;
    }

    let config = require(configPath);

    let srcDirPath = join(process.cwd(), config.src);
    let destDirPath = join(process.cwd(), config.dest);

    if (!existsSync(srcDirPath)) await fs.promises.mkdir(srcDirPath);
    if (!existsSync(destDirPath)) await fs.promises.mkdir(destDirPath);

    console.log('Watching: \x1b[1m' + srcDirPath + '\x1b[0m');
    console.log('Putting modified files in: \x1b[1m' + destDirPath + '\x1b[0m');

    watch(srcDirPath, async (event, file) => {
        if (!existsSync(destDirPath)) await fs.promises.mkdir(destDirPath);

        let filePath = join(srcDirPath, file);
        let fileOutputPath = join(destDirPath, file);
        let fileContents = await fs.promises.readFile(filePath).toString();

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
        await fs.promises.writeFile(fileOutputPath, fileContents);
    });
}