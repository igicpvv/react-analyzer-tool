const path = require('path');
const { getDictReadFiles, writeFile } = require("../lib");
const parser = require("@babel/parser");
const traverse = require("@babel/traverse").default;
const generator = require("@babel/generator").default;

const projectDir = process.env.projectDir || process.env.npm_config_projectDir;
const ___DRY_RUN = (process.env.DRY_RUN || process.env.npm_config_dry_run) ?? false;
const ___EXT = process.env.EXT;

if (!projectDir) {
    console.error("--projectDir needed!");
    return;
}

class FileElement {
    name = "";
    comments = new Set();
    constructor(name) {
        this.name = name;
    }
}
class CommentCount {
    content = "";
    count = 0;
    constructor(content) {
        this.content = content;
    }
}

function FileContext(file) {
    function _CountStepIncrement(path) {
        // if (path.node.leadingComments)
        //     for (const comment of path.node.leadingComments)
        //         file.comments.add(new CommentCount(comment.value));
        if (path.node.trailingComments)
            for (const comment of path.node.trailingComments)
                file.comments.add(new CommentCount(comment.value));
    }
    function _Remove(path) {
        // if (path.node.leadingComments) path.node.leadingComments = null;
        if (path.node.trailingComments) path.node.trailingComments = null;
    }

    return { _CountStepIncrement, _Remove };
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
    const { _CountStepIncrement, _Remove } = FileContext(file);
    total_files.push(file);

    //commnets count
    traverse(ast, {
        enter(path) {
            _CountStepIncrement(path);
        },
    });

    //comments remove
    traverse(ast, {
        enter(path) {
            _Remove(path);
        }
    });

    if (!___DRY_RUN) {
        const result = generator(ast);
        if (file.comments.size > 0)
            writeFile(file.name, result.code);
    }
}

if (___DRY_RUN)
    for (const file of total_files) {
        console.log(`${file.name} - Comments: ${file.comments.size}`);
    }

console.log("#");
