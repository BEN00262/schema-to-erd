// generated the plantUML dsl ( https://plantuml.com/ie-diagram )
/**
 * @author John Kerama <johnnesta2018@gmail.com>
 */

const SequelizeAuto = require('sequelize-auto');
const inquirer = require('inquirer');
const consola = require('consola');
const CLIInfinityProgress = require('cli-infinity-progress');
const path = require('path');
const fs = require('fs');
const { nanoid } = require('nanoid');
const plantumlEncoder = require('plantuml-encoder');
const open = require('open');

const get_table_name = raw_table_name => raw_table_name?.split(".")[1]

function generate_plantuml_reference(table_name) {
    return table_name?.toLowerCase().split(" ").join("_")
}

// add checks for allowNull fields ( nullable fields )
function generate_plantuml_dsl(table_name, fields) {
    return `entity "${table_name}" as ${generate_plantuml_reference(table_name)} {
        ${fields.map(({name, type, primaryKey, autoIncrement }) => {
            return `*${name} : ${type} ${primaryKey ? "PK" : ""} ${autoIncrement ? "AUTO" : ""}`
        }).join("\n--\n")}
      }`
}

const generate_db_graph = async ({database_name, database_user,
    database_password, database_host,
    database_dialect, database_port 
}) => {
    const auto = new SequelizeAuto(
        database_name, database_user, database_password, {
            host: database_host,
            dialect: database_dialect,
            port: database_port,
            noWrite: true,
            logging:false
        }
    );

    let generated_d2_dsl = '';

    const tables = []; // nodes ( we want to create edges between them )

    const data = await auto.run()

    for (let [table_name, table_structure] of Object.entries(data.tables)) {
        if (table_name.toLowerCase() === 'public.sequelizemeta') {
            continue // ignore this table its of no use to us
        }

        table_name = get_table_name(table_name)

        fields = []
        
        for (const [ts_name, ts_value] of Object.entries(table_structure)) {
            switch (ts_value.type) {
                case 'TIMESTAMP WITH TIME ZONE':
                    ts_value.type = 'DATE'
                    break;
                default:
                    // check if the value matches CHARACTER VARYING(100) if so do the conversion
                    if (/CHARACTER VARYING\(\d+\)/.test(ts_value.type)) {
                        const value = ts_value.type.match(/\d+/)[0]
                        ts_value.type = `VARCHAR(${+value})`
                    }
            }

            fields.push({
                name: ts_name,
                type: ts_value.type,
                primaryKey: ts_value.primaryKey,
                // add metadata on the required fields and stuff
                autoIncrement: (() => {
                    let default_value = ts_value.defaultValue
                    if (default_value) {
                        if (default_value.toLowerCase().startsWith('nextval(')){
                            return true
                        }
                    }

                    return false
                })()
            })
        }

        tables.push({
            table: table_name,
            fields: fields,
            relations: []
        })
    }

    for (const relationship_edge of data.relations) {
        const parent_table_name = get_table_name(relationship_edge.parentTable)
        const child_table_name = get_table_name(relationship_edge.childTable)
        let relationship_type = 'o2m'

        if (relationship_edge.isOne) {
            relationship_type = 'o2o'
        } else if (relationship_edge.isM2M) {
            relationship_type = 'm2m'
        }

        // find the parent table
        let child_table_index = tables.findIndex(table => table.table === child_table_name)
        if (child_table_index > -1) {
            // find the child table ( make sure the child table exists )
            let parent_table_index = tables.findIndex(table => table.table === parent_table_name)

            if (parent_table_index > -1) {
                // add the relationship
                let resolved_relation_symbol = '';

                /*
                    Type	    Symbol
                    Zero or One	|o--
                    Exactly One	||--
                    Zero or Many	}o--
                    One or Many	}|--
                */

                switch (relationship_type) {
                    case 'o2m':
                        resolved_relation_symbol = '||..|{';
                        break;
                    case 'o2o':
                        resolved_relation_symbol = '||..||';
                        break;
                    case 'm2m':
                        resolved_relation_symbol = '}|..|{';
                        break;
                }

                if (resolved_relation_symbol) {
                    tables[child_table_index].relations.push(
                        `${generate_plantuml_reference(parent_table_name)} ${resolved_relation_symbol} ${generate_plantuml_reference(tables[child_table_index].table)}`
                    );
                }
            }
        }
    }

    // go through the tables and create edges between them
    const relationship_tree = [];

    for (const table of tables) {
        generated_d2_dsl += `${generate_plantuml_dsl(table.table, table.fields)}\n\n`;
        relationship_tree.push(table.relations);
    }

    return `@startuml
    ' hide the spot
hide circle

' avoid problems with angled crows feet
skinparam linetype ortho

    ${generated_d2_dsl}\n\n${relationship_tree.flat().filter(unit => unit).join("\n")}\n@enduml`;
}


// commander to request for the requirements and then ui display for something 
async function ask_config_questions() {
    const answers = await inquirer.prompt([
        // database name
        {
            type: 'confirm',
            name: 'load_from_env_file',
            message: 'Load credentials from .env file'
        },
        {
            type: 'input',
            name: 'database_name',
            message: 'Enter the database name',
            when: (answers) => !answers.load_from_env_file
        },
        {
            type: 'input',
            name: 'database_user',
            message: 'Enter the database user',
            when: (answers) => !answers.load_from_env_file
        },
        {
            type: 'password',
            name: 'database_password',
            message: 'Enter the database password',
            when: (answers) => !answers.load_from_env_file
        },
        {
            type: 'input',
            name: 'database_host',
            message: 'Enter the database host',
            when: (answers) => !answers.load_from_env_file
        },
        {
            type: 'list',
            name: 'database_dialect',
            message: 'Select the database dialect',
            // https://sequelize.org/docs/v6/getting-started/
            /* one of 'mysql' | 'postgres' | 'sqlite' | 'mariadb' | 'mssql' | 'db2' | 'snowflake' | 'oracle' */
            choices: ['postgres', 'mysql', 'mssql', 'sqlite', 'mariadb', 'db2', 'snowflake', 'oracle'],
            when: (answers) => !answers.load_from_env_file
        },
        {
            type: 'number',
            name: 'database_port',
            message: 'Enter the database port',
            when: (answers) => !answers.load_from_env_file
        }
    ]);

    return answers;
}

const CURRENT_EXECUTION_DIRECTORY = process.cwd();

const map_env_keys_to_compatible_object = () => {
    require('dotenv').config({ path: path.join(CURRENT_EXECUTION_DIRECTORY, '.env') });

    // get the keys and then translate them
    return {
        database_name: process.env.DB_NAME,
        database_user: process.env.DB_USER,
        database_host: process.env.DB_HOST,
        database_password: process.env.DB_PASS,
        database_dialect: process.env.DB_DIALECT,
        database_port: +process.env.DB_PORT
    }
}

async function generate_uml_diagrams() {
    const answers = await ask_config_questions();
    const progress = new CLIInfinityProgress();
    progress.setHeader('Generating database table schemas')

    if (Object.keys(answers).length) {
            progress.start(); 

            const generated_plantuml_schemas = await generate_db_graph(
                answers?.load_from_env_file ? map_env_keys_to_compatible_object() : answers
            );

            progress.stop();

            const generated_plantuml_url = `http://www.plantuml.com/plantuml/svg/${plantumlEncoder.encode(generated_plantuml_schemas)}`;

            consola.info(`Opening the generated schema in your browser at ${generated_plantuml_url}`);
            open(generated_plantuml_url)

            // then write this view ( add a function exposed to enable one to open this files directly )
            const path_to_write_schema_to = path.join(CURRENT_EXECUTION_DIRECTORY, `${nanoid(24)}.plantuml`);

            consola.info(`Writing the generated schema into ${path_to_write_schema_to}`)
            fs.writeFileSync(path_to_write_schema_to, generated_plantuml_schemas);
    } else {
            consola.error("Not enough arguments")
    }
}

function open_plantuml_schema_diagram(file_path) {
    // verify its a valid file then encode it and open it
    const generated_plantuml_schemas = fs.readFileSync(
        path.isAbsolute(file_path) ? file_path :
        path.join(CURRENT_EXECUTION_DIRECTORY, file_path), 'utf-8');

    const generated_plantuml_url = `http://www.plantuml.com/plantuml/svg/${plantumlEncoder.encode(generated_plantuml_schemas)}`;

    consola.info(`Opening the generated schema in your browser at ${generated_plantuml_url}`);
    open(generated_plantuml_url)
}

module.exports = {
    generate_uml_diagrams,
    open_plantuml_schema_diagram
}