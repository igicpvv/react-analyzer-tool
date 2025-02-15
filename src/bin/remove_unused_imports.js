const path = require('path');
const { getFiles, getDictReadFiles } = require("../lib");
const parser = require("@babel/parser");
const traverse = require("@babel/traverse").default;
const generator = require("@babel/generator").default;

const projectDir = process.env.projectDir || process.env.npm_config_projectDir;

console.log(projectDir);
if (!projectDir)
{
    console.error("--projectDir needed!");
    return;
}

class File {
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

const total_files = [];
const files = getDictReadFiles(projectDir, ".jsx");
for (const fileIndex in files) {
    const content = files[fileIndex];
    const ast = parser.parse(content, {
        sourceType: 'module',
        plugins: ["jsx", "classProperties"]
    });

    const file = new File(fileIndex);
    total_files.push(file);
    traverse(ast, {
        enter(path) {
            if (path.node.leadingComments || path.node.trailingComments)
                path.skip();
        },
        ImportDeclaration(path) {
            for (const i in path.node.specifiers)
                file.imports.add(new ImportCount(path.node.specifiers[i].local.name));
        },
        Identifier(path) {
            if (path.findParent((n) => n.isImportDeclaration())) return;
            let importCount;
            if (path.node.name && (importCount = [...file.imports].find(_import => _import.name === path.node.name)))
                importCount.add();
        },
    });

    traverse(ast, {
        ImportDeclaration(path) {
            let iCount;
            for (const i in path.node.specifiers)
                if (((iCount = [...file.imports].find(_import => _import.name == path.node.specifiers[i].local.name)) != null) && iCount.total() == 0)
                    path.remove();
        }
    });
}

for (const file of total_files) {
    console.log(file.name);
    for (const importCount of [...file.imports])
        console.log(`${importCount.name} - ${importCount.total()}`);
}

console.log("#");
