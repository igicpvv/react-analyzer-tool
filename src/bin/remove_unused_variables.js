const path = require('path');
const { getDictReadFiles, writeFile, MethodAdapter, ClassAdapter, IdentifierAdapter, FileElement, VariableElement, MethodScopeElement } = require("../lib");
const parser = require("@babel/parser");
const traverse = require("@babel/traverse").default;
const generator = require("@babel/generator").default;

// const projectDir = process.env.projectDir || process.env.npm_config_projectDir;
const projectDir = "C:/@/Web/Template/Angle/portal_profcontrol_cliente/src";
const ___DRY_RUN = (process.env.DRY_RUN || process.env.npm_config_dry_run) ?? true;
const ___EXT = process.env.EXT;

if (!projectDir) {
    console.error("--projectDir needed!");
    return;
}

function FileContext(file) {
    function _StepIncrement(path) {
        const identifier = new IdentifierAdapter(path);
        // console.log(file.name, identifier.classs.name, identifier.method.name, path.node.name);
        const variable = file.getVar(identifier.classs, identifier.method, path.node.name);
        if (variable) variable.add();
    }
    function _Remove(path) {
        const entity = [...file.variables].find(x => x.name == path.node.name);
        if (entity && entity.total() == 0) path.remove();
    }

    return { _StepIncrement, _Remove };
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
    const { _StepIncrement, _Remove } = FileContext(file);
    total_files.push(file);

    //commnets add
    traverse(ast, {
        ImportDeclaration(path) {
            path.skip();
        },
        CallExpression(path) {
            path.skip();
        },
        VariableDeclaration(path) {
            const identifier = new IdentifierAdapter(path);
            const _class = identifier.classs;
            const _method = identifier.method;
            const list = identifier.declarations;

            for (const declarator of list)
                if (declarator.id?.name)
                    file.addVar(_class, _method, new VariableElement(declarator.id.name));
                else {
                    for (const oPattern of list)
                        if (oPattern.id.elements)
                            for (const item of oPattern.id.elements)
                                file.addVar(_class, _method, new VariableElement(item.name));
                        else
                            for (const propertie of oPattern.id.properties) // desconstrução;
                                if (propertie?.argument) file.addVar(_class, _method, new VariableElement(propertie.argument.name));
                                else file.addVar(_class, _method, new VariableElement(propertie.key.name));
                }
        },
        FunctionDeclaration(path) {
            const identifier = new IdentifierAdapter(path);
            const _class = identifier.classs;
            const _method = new MethodScopeElement(path.node.id.name);
            const list = identifier.params;

            for (const variable of list) {
                const _variable = new VariableElement(variable.name);
                file.addVar(_class, _method, _variable);
            }
        },
        ArrowFunctionExpression(path) {
            const property = path.findParent(p => p.isClassProperty());
            if (!property) { path.skip(); return }

            const identifier = new IdentifierAdapter(path);
            const _class = identifier.classs;
            const _method = new MethodScopeElement(property.node.key.name);
            const list = identifier.params;

            for (const variable of list) {
                const _variable = new VariableElement(variable.name);
                file.addVar(_class, _method, _variable);
            }
        },
    });

    //commnets count
    traverse(ast, {
        VariableDeclaration(path) {
            path.skip();
        },
        ImportDeclaration(path) {
            path.skip();
        },
        Identifier(path) {
            _StepIncrement(path);
        }
    });

    //comments remove
    traverse(ast, {
        VariableDeclaration(path) {
            // _Remove(path);
        }
    });

    if (!___DRY_RUN) {
        const result = generator(ast);


        if ([...file.variables].some(x => x.total() == 0))
            writeFile(file.name, result.code);
    }
}

if (___DRY_RUN)
    for (const file of total_files) {
        const variables = file.listVars();
        const zered = variables.filter(x => x.total() == 0);
        // console.log(`${file.name} - Variables: [Total:${variables.length}] [${variables.map(x => `${x.name}:${x.total()}`).join(",")}] - Unused: [Total:${zered.length}] [${zered.map(x => `${x.name}:${x.total()}`).join(",")}]`);

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

        // zered.forEach(variable => {
        //     console.log(`- ${variable.name} - ${variable.total()}`);
        // });
        // console.log((`}`));
    }

console.log("#");
