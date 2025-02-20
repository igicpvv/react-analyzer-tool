require('dotenv').config();
const fs = require('fs');
const path = require('path');
const babel = require("babel-core");

const ignored_files_path = [
    "node_modules"
];

const ignored_files = [
    "Menu.js",
    "wrapper.js",
    "modernizr.js",
    "Header.run.js",
    "Sidebar.run.js",
    "MonthFinancial.js"
];

function getJSFiles(dir) {
    const result = [];
    let files;
    files = fs.readdirSync(dir);
    for (const file in files) {

        if (ignored_files_path.indexOf(files[file]) != -1) continue;
        if (ignored_files.indexOf(files[file]) != -1) continue;

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
        if (ignored_files.indexOf(files[file]) != -1) continue;

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

class FileElement {
    name = "";
    constructor(name) {
        this.name = name;
    }
    variables = new Set();
    classes = new Set();
    functions = new Set();
    styles = [];

    getVar(_class, _method, varName) {
        if (_class.name == 0)
            if (_method.name == 0)
                return [...this.variables].find(x => x.name == varName);
            else {
                const functionElement = [...this.functions].find(x => x.name == _method.name);
                if (functionElement) return [...functionElement.variables].find(x => x.name == varName);
            }
        const classElement = [...this.classes].find(x => x.name == _class.name);
        if (classElement) {
            if (_method.name == 0) return [...classElement.variables].find(x => x.name == varName);
            const methodElement = [...classElement.methods].find(x => x.name == _method.name);
            if (methodElement) return [...methodElement.variables].find(x => x.name == varName);
        }
    }
    addVar(_class, _method, _variable) {
        if (_class.name == 0) {
            if (_method.name == 0) this.variables.add(_variable);
            else {
                const entity = [...this.functions].find(x => x.name == _method.name) || new FunctionScopeElement(_method.name);
                this.functions.add(entity);
                entity.variables.add(_variable);
            }
            return
        }
        let classElement = [...this.classes].find(x => x.name == _class.name);

        if (!classElement) {
            classElement = new ClassScopeElement(_class.name);
            this.classes.add(classElement);
        }
        if (_method.name == 0) { classElement.variables.add(_variable); return }
        let methodElement = [...classElement.methods].find(x => x.name == _method.name);
        if (!methodElement) {
            methodElement = new MethodScopeElement(_method.name);
            classElement.methods.add(methodElement);
        }
        methodElement.variables.add(_variable);
    }

    listVars() {
        const list = [];

        list.push(...this.variables);
        list.push(...[...this.classes].flatMap(x => [...x.variables]));
        list.push(...[...this.functions].flatMap(x => [...x.variables]));
        list.push(...[...this.classes].flatMap(x => [...x.methods].flatMap(xx => [...xx.variables])));

        return list;
    }
}
class ClassScopeElement {
    name = "";
    methods = new Set();
    variables = new Set();
    constructor(name) {
        this.name = name;
    }
}
class FunctionScopeElement {
    name = "";
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
        this._path = path;
    }

    get name() {
        return this.path().node.key.name;
    }

    path() {
        let method = { node: { key: { name: 0 } } };

        // default method;
        const isDefaultMethod = !!this._path.findParent(x => x.isClassMethod());
        if (isDefaultMethod) {
            method.node.key.name = this._path.findParent(x => x.isClassMethod())?.node.key.name;
            return method;
        }

        // arrow function;
        const isArrow = !!this._path.findParent(x => x.isArrowFunctionExpression());
        if (isArrow) {
            const property = this._path.findParent(x => x.isClassProperty());
            if (property) method.node.key.name = property.node.key.name;
        }

        const isFunctionDeclaration = !!this._path.findParent(x => x.isFunctionDeclaration());
        if (isFunctionDeclaration) {
            const property = this._path.findParent(x => x.isFunctionDeclaration());
            method.node.key.name = property.node.id.name;
        }

        return method;
    }

}

class ClassAdapter {
    constructor(path) {
        this._path = path;
    }

    MethodScope() {
        return new MethodAdapter(this._path).get();
    }

    inMethodScope() {
        return !!(new MethodAdapter(this._path).get());
    }

    get name() {
        return this.path().node.id.name;
    }

    path() {
        return this._path.findParent(x => x.isClassDeclaration()) ?? { node: { id: { name: 0 } } };
    }
}

class IdentifierAdapter {

    constructor(path) {
        this.path = path;
    }

    get name() {
        return this.path.node.name;
    }

    get classs() {
        return new ClassAdapter(this.path);
    }

    get method() {
        return new MethodAdapter(this.path);
    }

    get params() {
        return new ArrowFunctionAdapter(this.path).params();
    }

    get variables() {
        const _variables = [];

        const arrowFunction = this._path.findParent(p => p.isArrowFunctionExpression());
        if (!!arrowFunction) {
            const adapter = new IdentifierAdapter(arrowFunction);
            _variables.push(...adapter.params());
        }

        const defaultFunction = this._path.findParent(p => p.isFunctionDeclaration());
        if (!!defaultFunction) {
            const adapter = new IdentifierAdapter(defaultFunction);
            _variables.push(...adapter.params());
        }

        return _variables;
    }

    get declarations() {
        const _declarations = [];

        if (this.path.node?.declarations) _declarations.push(...this.path.node.declarations);

        return _declarations;
    }

}

class ArrowFunctionAdapter {
    constructor(path) {
        this._path = path;
    }

    params() {
        return this._path.node.params;
    }
}


function printFullFileComponent(file) {
    console.log((`${file.name} {`));
    console.log(`Globais:`);
    file.variables.forEach(v => {
        console.log(`\t${v.name} - ${v.total()}`);
    });
    console.log(`De Funções:`);
    file.functions.forEach(v => {
        console.log(`\t-${v.name}`);
        v.variables.forEach(v => {
            console.log(`\t\t-${v.name} - ${v.total()}`);
        });
    });

    // console.log(`De Classe:`);
    file.classes.forEach(c => {
        console.log(`\tclass ${c.name} {`);
        c.variables.forEach(variable_class => {
            console.log(`\t\t - ${variable_class.name} - ${variable_class.total()}`);
        });
        // console.log(`\tDe Métodos:`);
        c.methods.forEach(method => {
            console.log(`\t\t${method.name}() {`);
            method.variables.forEach(v => {
                console.log(`\t\t\t - ${v.name} - ${v.total()}`);
            });
            console.log(`\t\t\t}`);
        });
        console.log(`\t\t}`);
    });
}

function printZeredFileComponent(file) {
    console.log((`${file.name} {`));
    console.log(`Globais:`);
    [...file.variables].filter(x => x.total() == 0).forEach(v => {
        console.log(`\t${v.name} - ${v.total()}`);
    });
    console.log(`De Funções:`);
    file.functions.forEach(v => {
        console.log(`\t-${v.name}`);
        [...v.variables].filter(x => x.total() == 0).forEach(v => {
            console.log(`\t\t-${v.name} - ${v.total()}`);
        });
    });

    // console.log(`De Classe:`);
    file.classes.forEach(c => {
        console.log(`\tclass ${c.name} {`);
        [...c.variables].filter(x => x.total() == 0).forEach(variable_class => {
            console.log(`\t\t - ${variable_class.name} - ${variable_class.total()}`);
        });
        // console.log(`\tDe Métodos:`);
        c.methods.forEach(method => {
            console.log(`\t\t${method.name}() {`);
            [...method.variables].filter(x => x.total() == 0).forEach(v => {
                console.log(`\t\t\t - ${v.name} - ${v.total()}`);
            });
            console.log(`\t\t\t}`);
        });
        console.log(`\t\t}`);
    });
}

function id(path) {
    return `${path.node.start}-${path.node.end}`;
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
    IdentifierAdapter,
    printFullFileComponent,
    printZeredFileComponent,
    id
}