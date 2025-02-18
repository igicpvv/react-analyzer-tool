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
    writeFile,
    FileElement,
    ClassScopeElement,
    MethodScopeElement,
    VariableElement,
    MethodAdapter,
    ClassAdapter,
}

class FileElement {
    name = "";
    constructor(name) {
        this.name = name;
    }
    variables = new Set();
    elements = new Set();
}
class ClassScopeElement {
    name = "";
    methods = new Set();
    variables = new Set();
    constructor(name) {
        this.name = name;
    }
}
class MethodScopeElement {
    name = "";
    variables = new Set();
    constructor(name) {
        this.name = name;
    }
}
class VariableElement {
    name = "";
    count = 0;
    constructor(name) {
        this.name = name;
    }
    add() {
        this.count++;
    }
    total() {
        return this.count;
    }
}

class MethodAdapter {

    constructor(path) {
        this.path = path;
    }

    get name() {
        return this.get().node.key.name;
    }

    get() {
        return path.findParent(x => x.isClassMethod()) ?? { node: { key: { name: 0 } } };
    }

}

class ClassAdapter {
    constructor(path) {
        this.path = path;
    }

    MethodScope() {
        return new this.MethodScope(this.path).get();
    }

    inMethodScope() {
        return !!(new this.MethodScope(this.path).get());
    }

    get name() {
        return this.get().node.id.name;
    }

    get() {
        return path.findParent(x => x.isClassDeclaration()) ?? { node: { id: { name: 0 } } };
    }
}
