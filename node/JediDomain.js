/*jslint vars: true, plusplus: true, devel: true, nomen: true, regexp: true, indent: 4 */
/*global exports, require, $ */

(function () {
    "use strict";
    
    var process = require('child_process');
    
    var DOMAIN_NAME = "pythonJedi",
        COMMAND_DOMAIN = "jediCommand",
        EVENT_UPDATE = "update",
        EVENT_ERROR = "error";
    
    var childproc = null,
        _domainManager = null;
    
    function jediCommandHandler(modulePath, documentPath, source, line, col, callback) {
        var command = "python " + modulePath + "/python/jedi-complete.py " + documentPath + " '" + source + "' " + line + " " + col;
        console.log("[LOG:pythonJediCommand] command: " + command);
        
        /*
        process.exec(command, function (error, stdout, stderr) {
            console.log('stdout: ' + stdout);
            console.log('stderr: ' + stderr);
            if (error !== null) {
                console.log('exec error: ' + error);
                _domainManager.emitEvent(DOMAIN_NAME, EVENT_ERROR, stderr);
                return stderr;
            }
            _domainManager.emitEvent(DOMAIN_NAME, EVENT_UPDATE, stdout);
            return stdout;
        });
        */
        
        process.exec(command, function (err, stdout, stderr) {
            callback(err ? stderr : undefined, err ? undefined : stdout);
        });
        
        /*
        var child = process.spawn("python", [modulePath + "/python/jedi-complete.py", documentPath, "'" + source + "'", line + 4, col + 1]);
        var tmp = '';

        child.stdout.on('data', function (data) {
            tmp += data;
        });

        child.stderr.on('err', function (err) {
            //_domainManager.emitEvent(DOMAIN_NAME, EVENT_ERROR, err);
            console.log("Error: " + err);
            callback(err, undefined);
        });

        child.on('close', function (code) {
            //_domainManager.emitEvent(DOMAIN_NAME, EVENT_UPDATE, tmp);
            callback(undefined, tmp);
        });

        child.unref();
        */
    }

    function init(domainManager) {
        if (!domainManager.hasDomain("pythonJedi")) {
            domainManager.registerDomain("pythonJedi", {major: 0, minor: 1});
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
        
        /*
        domainManager.registerEvent(
            DOMAIN_NAME,
            EVENT_UPDATE,
            ["data"]
        );

        domainManager.registerEvent(
            DOMAIN_NAME,
            EVENT_ERROR,
            ["err"]
        );
        
        _domainManager = domainManager;
        */
    }

    exports.init = init;
}());
