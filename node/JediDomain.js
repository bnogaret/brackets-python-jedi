/*jslint vars: true, plusplus: true, devel: true, nomen: true, regexp: true, indent: 4 */
/*global exports, require, $ */


(function () {
    "use strict";
    
    var process = require('child_process'),
        fs      = require('fs');
    
    var DOMAIN_NAME = "pythonJedi",
        COMMAND_DOMAIN = "jediCommand";
    
    function jediCommandHandler(modulePath, projectRootPath, txt, line, col, callback) {
        var tmpPath = modulePath + '/python/jeditmp',
            command = "python " + modulePath + "/python/jedi-complete.py " + projectRootPath + " " + tmpPath + " " + line + " " + col;
        console.log("[LOG:jediCommandHandler] command: " + command);
        
        fs.writeFile(tmpPath, txt, function (err) {
            if (err) {
                callback(err, undefined);
            }
            process.exec(command, function (err, stdout, stderr) {
                callback(err ? stderr : undefined, err ? undefined : stdout);
            });
        });
    }

    function init(domainManager) {
        if (!domainManager.hasDomain(DOMAIN_NAME)) {
            domainManager.registerDomain(DOMAIN_NAME, {major: 0, minor: 1});
        }
        
        domainManager.registerCommand(
            DOMAIN_NAME,            // domain name
            COMMAND_DOMAIN,         // command name for the domain
            jediCommandHandler,     // command handler function
            true,                   // is-it asynchronous in Node ?
            // The last three parameters to registerCommand are documentation parameters.
            "Run command for Jedi", // Description
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
    }

    exports.init = init;
}());
