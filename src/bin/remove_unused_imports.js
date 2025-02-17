const path = require('path');
const { getDictReadFiles, writeFile } = require("../lib");
const parser = require("@babel/parser");
const traverse = require("@babel/traverse").default;
const generator = require("@babel/generator").default;

const projectDir = process.env.projectDir || process.env.npm_config_projectDir;
const ___DRY_RUN = (process.env.DRY_RUN || process.env.npm_config_dry_run) ?? false;
const ___EXT = process.env.EXT;

const __PRESERVE_IMPORT = [
    "React"
]

if (!projectDir) {
    console.error("--projectDir needed!");
    return;
}

class FileElement {
    name = "";
    imports = new Set();
    constructor(name) {
        this.name = name;
    }
}
class ImportCount {
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

function FileContext(file) {
    function _CountStepAdd(path) {
        file.imports.add(new ImportCount(path.node.local.name));
    }
    function _CountStepIncrement(path) {
        if (path.findParent((n) => n.isImportDeclaration())) return;
        let importCount;
        if (path.node.name && (importCount = [...file.imports].find(_import => _import.name === path.node.name)))
            importCount.add();
    }
    function _Remove(path, { childName }) {
        if ((((iCount = [...file.imports].find(_import => _import.name == path.node[childName].name)) != null) && iCount.total() == 0)
            && (__PRESERVE_IMPORT.indexOf(path.node.local.name) == -1)) {
            path.remove();

            const parent = path.findParent(p => p.isImportDeclaration());
            if (parent.node.specifiers.length == 0) parent.remove();
        }
    }

    return { _CountStepAdd, _CountStepIncrement, _Remove };
}

const total_files = [];
const files = getDictReadFiles(projectDir, ___EXT);
for (const fileIndex in files) {
    const content = files[fileIndex];
    const ast = parser.parse(content, {
        sourceType: 'module',
        plugins: ["jsx", "classProperties"]
    });

    const file = new FileElement(fileIndex);
    const { _CountStepAdd, _CountStepIncrement, _Remove } = FileContext(file);
    total_files.push(file);
    //import count
    traverse(ast, {
        // enter(path) {
        //     if (path.node.leadingComments || path.node.trailingComments)
        //         path.skip();
        // },
        ImportDefaultSpecifier(path) {
            _CountStepAdd(path);
        },
        ImportSpecifier(path) {
            _CountStepAdd(path);
        },
        Identifier(path) {
            _CountStepIncrement(path);
        },
        JSXIdentifier(path) {
            _CountStepIncrement(path);
        }
    });

    //import remove
    traverse(ast, {
        ImportDefaultSpecifier(path) {
            _Remove(path, { childName: "local" });
        },
        ImportSpecifier(path) {
            _Remove(path, { childName: "imported" });
        },
    });

    if (!___DRY_RUN) {
        const result = generator(ast);
        if ([...file.imports].some(_import => _import.total() == 0
            && (__PRESERVE_IMPORT.indexOf(_import.name) == -1))
        )
            writeFile(file.name, result.code);
    }
}

if (___DRY_RUN)
    for (const file of total_files) {
        console.log(file.name);
        for (const importCount of [...file.imports])
            console.log(`${importCount.name} - ${importCount.total()}`);
    }

console.log("#");
