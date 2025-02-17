require('dotenv').config();
const fs = require('fs');
const path = require('path');
const babel = require("babel-core");

const ignored_files_path = [
    "node_modules"
];

const ignore_imported_unused = [
    "React"
];

function getJSFiles(dir) {
    const result = [];
    let files;
    files = fs.readdirSync(dir);
    for (const file in files) {

        if (ignored_files_path.indexOf(files[file]) != -1) continue;

        const name = path.join(dir, files[file]);
        if (fs.statSync(name).isDirectory())
            result.push(...getJSFiles(name));
        else
            if (name.endsWith(".js") || name.endsWith(".jsx"))
                result.push(name);
    }
    return result;
}

function getFiles(dir, ext) {
    const result = [];
    let files;
    files = fs.readdirSync(dir);
    for (const file in files) {

        if (ignored_files_path.indexOf(files[file]) != -1) continue;

        const name = path.join(dir, files[file]);
        if (fs.statSync(name).isDirectory())
            result.push(...getFiles(name, ext));
        else
            if (name.endsWith(ext))
                result.push(name);
    }
    return result;
}

function writeFile(file, content) {
    fs.writeFileSync(file, content);
}

function getDictReadFiles(dir, ext) {
    const result = [];
    const files = getFiles(dir, ext);
    for (const file in files) {
        result[files[file]] = fs.readFileSync(files[file], 'utf-8');
    }
    return result;
}

module.exports = {
    getFiles,
    getJSFiles,
    getDictReadFiles,
    writeFile
}