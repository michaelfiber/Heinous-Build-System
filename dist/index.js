"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.HeinousBuild = void 0;
const fs_1 = __importStar(require("fs"));
const path_1 = require("path");
async function HeinousBuild() {
    let configPath = path_1.join(process.cwd(), "rewrite.config.json");
    if (!fs_1.existsSync(configPath)) {
        console.log('no config');
        return;
    }
    let config = require(configPath);
    let srcDirPath = path_1.join(process.cwd(), config.src);
    let destDirPath = path_1.join(process.cwd(), config.dest);
    if (!fs_1.existsSync(srcDirPath))
        await fs_1.default.promises.mkdir(srcDirPath);
    if (!fs_1.existsSync(destDirPath))
        await fs_1.default.promises.mkdir(destDirPath);
    console.log('Watching: \x1b[1m' + srcDirPath + '\x1b[0m');
    console.log('Putting modified files in: \x1b[1m' + destDirPath + '\x1b[0m');
    fs_1.watch(srcDirPath, async (event, file) => {
        if (!fs_1.existsSync(destDirPath))
            await fs_1.default.promises.mkdir(destDirPath);
        let filePath = path_1.join(srcDirPath, file);
        let fileOutputPath = path_1.join(destDirPath, file);
        let fileContents = await fs_1.default.promises.readFile(filePath).toString();
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
        await fs_1.default.promises.writeFile(fileOutputPath, fileContents);
    });
}
exports.HeinousBuild = HeinousBuild;
//# sourceMappingURL=index.js.map