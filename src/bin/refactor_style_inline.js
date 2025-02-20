const path = require('path');
const { getDictReadFiles, writeFile, MethodAdapter, ClassAdapter, IdentifierAdapter, FileElement, VariableElement, MethodScopeElement, printZeredFileComponent, id } = require("../lib");
const parser = require("@babel/parser");
const traverse = require("@babel/traverse").default;
const generator = require("@babel/generator").default;
const t = require("@babel/types");

// const projectDir = process.env.projectDir || process.env.npm_config_projectDir;
const projectDir = "C:/@/Web/Template/Angle/portal_profcontrol_cliente/src";
const ___DRY_RUN = (process.env.DRY_RUN || process.env.npm_config_dry_run) ?? false;
const ___EXT = process.env.EXT;

if (!projectDir) {
    console.error("--projectDir needed!");
    return;
}

class StyleElement {
    id;
    element;
    _idealName;

    set idealName(name) {
        this._idealName = name;
    }

    get idealName() {
        return this._idealName + this.id.replace("-", "");
    }

    constructor(id, element, idealName = '') {
        this.id = id;
        this.element = element;
        this.idealName = idealName[0].toLowerCase() + idealName.slice(1);
    }
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
    total_files.push(file);
    let lastPathImport = null;

    //styles add
    traverse(ast, {
        ImportDeclaration(path) {
            lastPathImport = path;
        },
        JSXElement(path) {
            const list = path.node.openingElement.attributes
                .filter(x => x.type == "JSXAttribute")
                .filter(x => x.name.name == "style");
            if (list.length == 0) return;

            for (const prop of list)
                if (prop.value.expression.type == "ObjectExpression")
                    file.styles[id(path)] = new StyleElement(id(path), prop.value.expression, path.node.openingElement.name.name);
        }
    });

    const objectExpression = [];
    for (const key of Object.keys(file.styles)) {
        const propertie = file.styles[key];
        objectExpression.push(
            t.objectProperty(t.identifier(propertie.idealName), propertie.element)
        );
    }
    const nodeObjectExpression = t.objectExpression(objectExpression);

    const newVariableDeclaration = t.variableDeclaration("const", [
        t.variableDeclarator(
            t.identifier("styles"),
            nodeObjectExpression
        )
    ]);
    if (lastPathImport)
        lastPathImport.insertAfter(newVariableDeclaration);
    else
        ast.program.body.unshift(newVariableDeclaration);


    //alter styles
    traverse(ast, {
        JSXElement(path) {
            // if (file.name.indexOf("AlertPermissionModal") != -1
            //     && path.node.openingElement.name.name == "ModalBody")
            //     console.log(file.name, path.node.openingElement.name.name);
            const list = path.node.openingElement.attributes
                .filter(x => x.type == "JSXAttribute")
                .filter(x => x.name.name == "style");
            if (list.length == 0) return;

            for (const prop of list)
                if (prop.value.expression.type == "ObjectExpression") {
                    prop.value.expression = t.memberExpression(
                        t.identifier("styles"),
                        t.identifier(file.styles[id(path)].idealName)
                    )
                }
        }
    });

    if (!___DRY_RUN) {
        const result = generator(ast);

        if (Object.keys(file.styles).length > 0)
            writeFile(file.name, result.code);
    }
}

if (___DRY_RUN)
    for (const file of total_files) {
        console.log(file.name);
        console.log("const styles = {");
        for (const styleKey of Object.keys(file.styles)) {
            console.log(` - ${file.styles[styleKey].idealName}`)
        }
        console.log("}");
    }
else {
    console.log("Arquivos modificados:");
    for (const file of total_files) {
        if (Object.keys(file.styles).length > 0) console.log(file.name, " - ", Object.keys(file.styles).length);
    }
}

console.log("#");
