# Heinous Build System
This is built quickly and used internally on small experimental projects. Don't try to use this on something complex or important.

## Philosophy
This "build system" watches for JS files in a **source directory**, checks for `import` statements that reference **specific packages** and either rewrites or removes each matching `import` statement. The resulting file is written out to a **destination directory**. It can also copy specific files to the **destination directory**.

Any non-JS file in the **source directory** will be copied to the **destination directory**.

You can also specify files that you would like copied into the **destination directory** by adding the path (relative to project root) to the "copy" array in the config.

A config file named **rewrite.config.json** at the root of your project is used to determine what to do.

```json
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
```

Using this config file:
* All files in the build folder are processed once when heinous-build is run and then the build folder is watched for changes.
* All files listed under "copy" are copied once when heinous-build is run and then the paths are watched for changes.
* if a JS file is saved to the "build" directory and it includes the line ```import Vue from 'vue';``` it will:
  1. rewrite that import to be ```import Vue from './vue.esm.browser.min.js';``` 
  2. save the result to the "dest" directory
  3. copy *./node_modules/vue/dist/vue.esm.browser.min.js* to the "dest" directory
* if a JS file is saved to the "build" directory and it includes ```import io from 'socket.io-client';``` it will:
  1. remove that line completely 
  2. save the result to the "dest" directory
  3. copy *./node_modules/socket.io-client/dist/socket.io.min.js* to the "dest" directory
* if any file listed under ```"copy": []``` is modified
  1. the file is copied to the "dest" directory

I use this in combination with a tsconfig file that builds my .ts files into .js files in the "build" directory. Then the instance of heinous-build-manager that is running sees those files created/changed and rewrites them based on the config and the result ends up in the "dist" directory. For my uses, this "dist" directory is the finished product during testing of new, rapidly developing, and generally very small projects.

## Using Heinous Build System
1. Install it with ```npm install --save-dev heinous-build-system```
2. Add a ```rewrite.config.json``` file in the root of your project and add the rewrites you want and the src and dest directories.
3. Add commands to the package.json. I use this:

```json
  ...
  "scripts": {
    "build": "tsc -w --preserveWatchOutput",
    "heinous": "heinous-build",
    "build-dist": "npm run build & npm run heinous"
  },
  ...
```

## Why would you do this?!?
When I am testing out something new I'll often throw together a quick project.  My starting steps are usually:

```bash
npm init -y
tsc --init
npm install --save vue socket.io-client
npm install --save-dev @types/vue @types/scoket.io-client
```

Then I update tsconfig to look in ./src/ for TS files and output JS to ./build/

Inside any browser code I build can use ```import Vue from 'vue';``` to pull in Vue with full typings including correctly seeing data and methods. 

Then, Heinous comes in and takes that import and fixes it to work in the browser in the copy i the ./dist/ folder.