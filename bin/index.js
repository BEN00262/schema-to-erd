#!/usr/bin/env node

const { 
    generate_uml_diagrams,
    open_plantuml_schema_diagram 
} = require('../index.js');

// check if we've been called with any arguments if so this is a file name else we dive into the inquirer
;(async () => {
    if (process.argv.length > 2) {
        open_plantuml_schema_diagram(process.argv[2] /* name of the file to be opened */)
    } else {
        await generate_uml_diagrams()
    }
})()

