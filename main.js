/*jslint vars: true, plusplus: true, devel: true, nomen: true, regexp: true, indent: 4 */
/*global define, $, brackets, window, Mustache */


/** 
    Python jedi extension
    Add autocomplete (using Jedi) for python documents
    Jedi must be already installed !
*/
define(function (require, exports, module) {
    "use strict";

    var CommandManager  = brackets.getModule("command/CommandManager"),
        DocumentManager = brackets.getModule("document/DocumentManager"),
        EditorManager   = brackets.getModule("editor/EditorManager"),
        AppInit         = brackets.getModule("utils/AppInit"),
        CodeHintManager = brackets.getModule("editor/CodeHintManager"),
        NodeDomain      = brackets.getModule("utils/NodeDomain"),
        NodeConnection  = brackets.getModule("utils/NodeConnection"),
        ProjectManager  = brackets.getModule("project/ProjectManager"),
        FileUtils       = brackets.getModule("file/FileUtils"),
        ExtensionUtils  = brackets.getModule("utils/ExtensionUtils"),
        Menus           = brackets.getModule("command/Menus");
    
    var MY_COMMAND_ID   = "bnogaret.brackets-python-jedi";
    var MENU_NAME       = "Python Jedi Power over 9000";
    
    var DOMAIN_NAME     = "pythonJedi";/*,
        COMMAND_NAME    = "pythonJediCommand",
        EVENT_UPDATE    = "update",
        EVENT_ERROR     = "error";
        */
    
    var modulePath      = ExtensionUtils.getModulePath(module),
        nodeConnection  = new NodeConnection(),
        domainPath      = ExtensionUtils.getModulePath(module) + "/node/JediDomain";
    
    var pythonJediDomain = new NodeDomain(DOMAIN_NAME, ExtensionUtils.getModulePath(module, "node/JediDomain"));
    
    function getHint(pythonCode, currentLine, currentCol) {
        /*
        pythonJediDomain.exec(COMMAND_NAME, modulePath, "/home/nogaret/.config/Brackets/extensions/user/python-jedi/python", "import json; json.dum", 1, 21)
            .done(function (data) {
                console.log("Data: " + data);
            })
            .fail(function (err) {
                console.log("Err: " + err);
            });
        */
        
        var deferred = new $.Deferred();
        
        nodeConnection.connect(true).fail(function (err) {
            console.error("[ERROR:getHint] connect to node: ", err);
            deferred.reject(err);
        }).then(function () {
            return nodeConnection.loadDomains([domainPath], true).fail(function (err) {
                console.error("[ERROR:getHint] domain: ", err);
            });
        }).then(function () {
            nodeConnection.domains[DOMAIN_NAME].jediCommand(modulePath, "/home/nogaret/.config/Brackets/extensions/user/python-jedi/python", pythonCode, currentLine, currentCol)
                .fail(function (err) {
                    console.error("[ERROR:getHint] result: ", err);
                    deferred.reject(err);
                })
                .done(function (data) {
                    console.log("Data:" + data);
                    var test = JSON.parse(data);
                    /*
                    test.forEach(function (node, number) {
                        console.log("Node " + number + " : " + JSON.stringify(node));
                    });
                    */
                    deferred.resolve(JSON.parse(data));
                });
        });
        
        return deferred;
    }
    
    /**
        http://brackets.io/docs/current/modules/editor/CodeHintManager.html
    */
    function PythonJediHintProvider() {
        var editor;
        
        this.hasHints = function (editor, implicitChar) {
            console.log("hasHints");
            this.editor = editor;
            //console.log(editor);
            //console.log(editor.document.file.fullPath);
            //console.log(implicitChar);
            return true;
        };
        
        // TODO let the '.' ?
        var ignoredtokens = [' ', '+', '-', '/', '*', '(', ')', '[', ']', ':', ',', '<', '>', '.', '{', '}', '=', '%', '!'];

        function isValidToken(implicitChar) {
            if (implicitChar) {
                var code = implicitChar.charCodeAt(0);
                // Unicode 13 : carrage return
                // Unicode 9 : tabulation
                return (ignoredtokens.indexOf(implicitChar) === -1) && (code !== 13) && (code !== 9);
            } else {
                return false;
            }
        }
        
        
        /**
        *   TODO : cache ?
        */
        this.getHints = function (implicitChar) {
            console.log("getHints");
            //console.log(this.editor.document.getText());
            console.log(this.editor._codeMirror.getValue());
            
            if (isValidToken(implicitChar)) {
                var deferred = new $.Deferred();
                
                var currentLinePosition = this.editor.getCursorPos().line + 1,
                    currentColPosition = this.editor.getCursorPos().ch;
                
                getHint(this.editor.document.getText(), currentLinePosition, currentColPosition)
                    .fail(function (err) {
                        deferred.reject(err);
                    })
                    .then(function (dataJSON) {
                        var hintList = [];
                        
                        console.log("Done:" + JSON.stringify(dataJSON));
                        
                        dataJSON.forEach(function (node, number) {
                            hintList.push(node.name);
                        });
                    
                        //hintList.push("Hello");
                        hintList.sort();
                    
                        deferred.resolve({
                            hints: hintList,
                            match: false,
                            selectInitial: true,
                            handleWideResults: false
                        });
                    });
                return deferred;
            } else {
                return false;
            }
        };
        
        this.insertHint = function (hint) {
            console.log("insertHint");
            var cursor              = this.editor.getCursorPos(),
                currentToken        = this.editor._codeMirror.getTokenAt(cursor),
                startToken          = {line: cursor.line, ch: currentToken.start},
                endToken            = {line: cursor.line, ch: cursor.ch};
            console.log(hint);
            console.log(cursor);
            console.log(currentToken);
            console.log(startToken);
            console.log(endToken);
            this.editor.document.replaceRange(hint, startToken, endToken);
            return false;
        };
    }
    

    function isLanguagePython(editor) {
        return editor.language.getId() === "python";
    }

    function menusHandler() {
        if (isLanguagePython(DocumentManager.getCurrentDocument())) {
            window.alert("C'est du python !");
        } else {
            window.alert("Ce n'est pas du python.");
        }
    }

    
    AppInit.appReady(function () {
        console.log(modulePath);
        var currentEditor = EditorManager.getCurrentFullEditor();
        CodeHintManager.registerHintProvider(new PythonJediHintProvider(), ["python"], 1);
        
        getHint("fo", 1, 2);
        
        /*
        pythonJediDomain.on(EVENT_UPDATE, function (evt, data) {
            console.log("Evt DATA : " + data);
        });

        pythonJediDomain.on(EVENT_ERROR, function (evt, err) {
            console.log("Evt ERR : " + err);
        });
        */
    });


    // First, register a command - a UI-less object associating an id to a handler
    // package-style naming to avoid collisions
    CommandManager.register(MENU_NAME, MY_COMMAND_ID, menusHandler);

    // Then create a menu item bound to the command
    // The label of the menu item is the name we gave the command (see above)
    var menu = Menus.getMenu(Menus.AppMenuBar.FILE_MENU);
    menu.addMenuItem(MY_COMMAND_ID);
});