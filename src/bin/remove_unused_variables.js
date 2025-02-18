const path = require('path');
const { getDictReadFiles, writeFile, MethodAdapter, ClassAdapter } = require("../lib");
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

function _getVariablesByClass(file) {
    const variables = [];

    for (const _class of file.elements) {
        variables.push(..._class.variables);
        for (const methods of _class.methods) {
            variables.push(...methods.variables);
        }
    }

    return variables;
}

function _getVariablesByClass2(file) {
    const variables = {};

    for (let i = 0; i < file.elements.size; i++) {
        const _class = [...file.elements][i];
        const className = _class?.name ?? 0;
        for (const methods of [..._class.methods]) {
            const methodName = methods?.name ?? 0;

            if (!variables[className]) variables[className] = [];
            if (!variables[className][methodName]) variables[className][methodName] = [];

            variables[className][methodName].push(...methods.variables);
        }
    }

    return variables;
}

function FileContext(file) {
    function _StepAdd(path) {
        const classScope = new ClassAdapter(path);

        const _class = [...file.elements].find(x => x.name == classScope.name);

        if (classScope.inMethodScope())
            

        // let _class;
        // if (classScope) {
        //     _class = [...file.elements].find(x => x.name == classScope.node.id.name);
        //     if (!_class) {
        //         _class = new ClassScopeElement(classScope.node.id.name);
        //         file.elements.add(_class);
        //     }
        // }

        // let _method;
        // if (methodScope) {
        //     _method = [..._class.methods].find(x => x.name == methodScope.node.key.name);
        //     if (!_method) {
        //         _method = new MethodScopeElement(methodScope.node.key.name);
        //         _class.methods.add(_method);
        //     }
        // }

        // let _variable = new VariableElement(path.node.name);

        // if (_method) _method.variables.add(_variable);
        // else if (_class) _class.variables.add(_variable);
        // else file.variables.add(_variable);
    }
    function _StepIncrement(path) {
        const _class = path.findParent(x => x.isClassDeclaration());
        const _method = path.findParent(x => x.isClassMethod());

        const className = _class?.node?.id?.name ?? 0;
        const methodName = _method?.node?.key?.name ?? 0;

        const variables = _getVariablesByClass2(file);

        console.log(className, methodName);
        variables[className][methodName].find(x => x.name == path.node.name).add();
    }
    function _Remove(path) {
        const entity = [...file.variables].find(x => x.name == path.node.name);
        if (entity && entity.total() == 0) path.remove();
    }

    return { _StepAdd, _StepIncrement, _Remove };
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
    const { _StepAdd, _StepIncrement, _Remove } = FileContext(file);
    total_files.push(file);

    //commnets add
    traverse(ast, {
        ImportDeclaration(path) {
            path.skip();
        },
        CallExpression(path) {
            path.skip();
        },
        Identifier(path) {
            const parent = path.findParent(p => p.isVariableDeclaration() || p.isArrowFunctionExpression());
            if (parent) _StepAdd(path);
        }
    });

    //commnets count
    traverse(ast, {
        ImportDeclaration(path) {
            path.skip();
        },
        Identifier(path) {
            const variables = _getVariablesByClass(file);

            if (variables.some(x => x.name == path.node.name)) _StepIncrement(path);
        }
    });

    //comments remove
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
        const variables = _getVariablesByClass(file);
        console.log(`${file.name} - Variables: [Total:${variables.length}] [${variables.map(x => `${x.name}:${x.total()}`).join(",")}] - Unused: ${[...file.variables].filter(x => x.total() == 0).length}`);
    }

console.log("#");
