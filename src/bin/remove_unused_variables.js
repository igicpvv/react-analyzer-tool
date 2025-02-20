const path = require('path');
const { getDictReadFiles, writeFile, MethodAdapter, ClassAdapter, IdentifierAdapter, FileElement, VariableElement, MethodScopeElement, printZeredFileComponent } = require("../lib");
const parser = require("@babel/parser");
const traverse = require("@babel/traverse").default;
const generator = require("@babel/generator").default;

const projectDir = process.env.projectDir || process.env.npm_config_projectDir;
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
        const adapter = new IdentifierAdapter(path);
        const _class = adapter.classs;
        const _method = adapter.method;
        // const _variables = adapter.variables;
        const declarations = adapter.declarations;

        let for_remove = {
            id_name: [],
            id_elements: [],
            else_id_properties: [],
            arguments: []
        }

        for (const key in declarations) {
            const declarator = declarations[key];
            if (declarator.id?.name) { // única variável declarada;
                const entity = file.getVar(_class, _method, new VariableElement(declarator.id.name));
                if (!!entity && entity.total() == 0) for_remove.id_name.push([key, declarator]);
            } else {
                for (const pkey in declarations) {
                    const oPattern = declarations[pkey];
                    if (oPattern.id.elements) {
                        for (const skey in oPattern.id.elements) {
                            const item = oPattern.id.elements[skey];
                            const entity = file.getVar(_class, _method, item.name);
                            if (!!entity && entity.total() == 0) {
                                // console.log("oPattern.id.elements", _class.name, _method.name, item.name);
                                for_remove.id_elements.push([pkey, skey, item]);
                            }
                        }
                    } else {
                        for (const skey in oPattern.id.properties) {
                            const propertie = oPattern.id.properties[skey];
                            if (propertie?.argument) {
                                const entity = file.getVar(_class, _method, propertie.argument.name);
                                if (!!entity && entity.total() == 0) {
                                    // console.log("oPattern.id.properties", _class.name, _method.name, item.name);
                                    for_remove.arguments.push([pkey, skey, propertie]);
                                }
                            } else {
                                const entity = file.getVar(_class, _method, propertie.key.name);
                                if (!!entity && entity.total() == 0) {
                                    for_remove.else_id_properties.push([pkey, skey, propertie]);
                                }
                            }
                        }
                    }
                }
            }
        }

        for (const item of for_remove.id_name)
            path.remove();
        for (const item of for_remove.id_elements) {
            path.node.declarations[item[0]].id.elements[item[1]] = null;
            path.node.declarations[item[0]].id.elements = path.node.declarations[item[0]].id.elements.filter(x => x != null);
        }
        for (const item of for_remove.else_id_properties) path.node.declarations[item[0]].id.properties[item[1]] = null;
        for (const item of for_remove.arguments) path.node.declarations[item[0]].id.properties[item[1]].argument = null;

        for (const item of for_remove.else_id_properties) if (for_remove.else_id_properties.length > 0) path.node.declarations[item[0]].id.properties = path.node.declarations[item[0]].id.properties.filter(x => x != null);
        for (const item of for_remove.arguments) if (for_remove.arguments.length > 0) path.node.declarations[item[0]].id.properties = path.node.declarations[item[0]].id.properties.filter(x => x.argument != null);
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

    //variables add
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

    //variables count
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

    //variables remove
    traverse(ast, {
        VariableDeclaration(path) {
            _Remove(path);
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

        printZeredFileComponent(file);

        // zered.forEach(variable => {
        //     console.log(`- ${variable.name} - ${variable.total()}`);
        // });
        // console.log((`}`));
    }

console.log("#");
