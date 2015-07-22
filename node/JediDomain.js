/*jslint vars: true, plusplus: true, devel: true, nomen: true, regexp: true, indent: 4 */
/*global exports, require, $, brackets */


(function () {
    "use strict";
    
    var process                 = require('child_process'),
        fs                      = require('fs');
    
    var DOMAIN_NAME             = "pythonJedi",
        COMMAND_NAME_HINT       = "jediHintCommand",
        COMMAND_NAME_GOTO       = "jediGotoCommand",
        COMMAND_NAME_DOC        = "jediDocCommand",
        RELATIVE_PATH_FILE      = "python/jeditmp",
        RELATIVE_PATH_SCRIPT    = "python/jedi-complete.py";
    
    function executeHandler(command, callback) {
        console.log("[Execute]: " + command);
        process.exec(command, function (err, stdout, stderr) {
            callback(err ? stderr : undefined, err ? undefined : stdout);
        });
    }
    
    function jediHintCommandHandler(modulePath, projectRootPath, txt, line, col, callback) {
        var pathFileTmp = modulePath + RELATIVE_PATH_FILE,
            pathScript = modulePath + RELATIVE_PATH_SCRIPT,
            command = "python" + " " + pathScript + " " + projectRootPath + " " + pathFileTmp + " " + line + " " + col + " " + "completions";
        
        fs.writeFile(pathFileTmp, txt, function (err) {
            if (err) {
                callback(err, undefined);
            }
            executeHandler(command, callback);
        });
    }
    
    function jediGotoCommandHandler(modulePath, projectRootPath, txt, line, col, callback) {
        var pathFileTmp = modulePath + RELATIVE_PATH_FILE,
            pathScript = modulePath + RELATIVE_PATH_SCRIPT,
            command = "python" + " " + pathScript + " " + projectRootPath + " " + pathFileTmp + " " + line + " " + col + " " + "goto";
        
        fs.writeFile(pathFileTmp, txt, function (err) {
            if (err) {
                callback(err, undefined);
            }
            executeHandler(command, callback);
        });
    }
    
    function jediDocCommandHandler(modulePath, projectRootPath, txt, line, col, callback) {
        var pathFileTmp = modulePath + RELATIVE_PATH_FILE,
            pathScript = modulePath + RELATIVE_PATH_SCRIPT,
            command = "python" + " " + pathScript + " " + projectRootPath + " " + pathFileTmp + " " + line + " " + col + " " + "documentation";
        
        fs.writeFile(pathFileTmp, txt, function (err) {
            if (err) {
                callback(err, undefined);
            }
            executeHandler(command, callback);
        });
    }

    function init(domainManager) {
        if (!domainManager.hasDomain(DOMAIN_NAME)) {
            domainManager.registerDomain(DOMAIN_NAME, {major: 0, minor: 1});
        }
        
        domainManager.registerCommand(
            DOMAIN_NAME,            // domain name
            COMMAND_NAME_HINT,         // command name for the domain
            jediHintCommandHandler,     // command handler function
            true,                   // is-it asynchronous in Node ?
            // The last three parameters to registerCommand are documentation parameters.
            "Hint command (using Jedi)", // Description
            [                       // List parameters
                {
                    name: "modulePath",
                    type: "string"
                },
                {
                    name: "documentPath",
                    type: "string"
                },
                {
                    name: "source",
                    type: "string"
                },
                {
                    name: "line",
                    type: "int"
                },
                {
                    name: "col",
                    type: "int"
                }
            ],
            []
        );
        
        domainManager.registerCommand(
            DOMAIN_NAME,
            COMMAND_NAME_GOTO,
            jediGotoCommandHandler,
            true,
            "Goto command (using Jedi)",
            [],
            []
        );
        
        domainManager.registerCommand(
            DOMAIN_NAME,
            COMMAND_NAME_DOC,
            jediDocCommandHandler,
            true,
            "Get documentation (using Jedi)",
            [],
            []
        );
    }

    exports.init = init;
}());
