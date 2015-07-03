/*jslint vars: true, plusplus: true, devel: true, nomen: true, regexp: true, indent: 4 */
/*global define, $, brackets, window, Mustache */


/** 
    Python jedi extension
    Add autocomplete (using Jedi) for python documents
*/
define(function (require, exports, module) {
    "use strict";

    var CommandManager  = brackets.getModule("command/CommandManager"),
        DocumentManager = brackets.getModule("document/DocumentManager"),
        AppInit         = brackets.getModule("utils/AppInit"),
        CodeHintManager = brackets.getModule("editor/CodeHintManager"),
        NodeDomain      = brackets.getModule("utils/NodeDomain"),
        NodeConnection  = brackets.getModule("utils/NodeConnection"),
        ProjectManager  = brackets.getModule("project/ProjectManager"),
        ExtensionUtils  = brackets.getModule("utils/ExtensionUtils"),
        Menus           = brackets.getModule("command/Menus");
    
    var MY_COMMAND_ID   = "bnogaret.brackets-python-jedi",
        MENU_NAME       = "Python Jedi Power over 9000",
        DOMAIN_NAME     = "pythonJedi";
    
    var modulePath      = ExtensionUtils.getModulePath(module),
        nodeConnection  = new NodeConnection(),
        domainPath      = ExtensionUtils.getModulePath(module) + "/node/JediDomain",
        pythonJediDomain = new NodeDomain(DOMAIN_NAME, ExtensionUtils.getModulePath(module, "node/JediDomain"));
    
    function getHint(pythonCode, projectRootPath, currentLine, currentCol) {
        
        var deferred = new $.Deferred();
        
        nodeConnection.connect(true).fail(function (err) {
            console.error("[ERROR:getHint] connect to node: ", err);
            deferred.reject(err);
        }).then(function () {
            return nodeConnection.loadDomains([domainPath], true).fail(function (err) {
                console.error("[ERROR:getHint] domain: ", err);
            });
        }).then(function () {
            nodeConnection.domains[DOMAIN_NAME].jediCommand(modulePath, projectRootPath, pythonCode, currentLine, currentCol)
                .fail(function (err) {
                    console.error("[ERROR:getHint] result: ", err);
                    deferred.reject(err);
                })
                .done(function (data) {
                    console.log("Data:" + data);

                    deferred.resolve(JSON.parse(data));
                });
        });
        
        return deferred;
    }
    
    /**
        http://brackets.io/docs/current/modules/editor/CodeHintManager.html
    */
    function PythonJediHintProvider() {
        
        var ignoredChar = [' ', '+', '-', '/', '*', '(', ')', '[', ']', ':', ',', '<', '>', '.', '{', '}', '=', '%', '!'],
            editor,
            projectRootPath;
        
        function isValidToken(implicitChar) {
            if (implicitChar) {
                var code = implicitChar.charCodeAt(0);
                // Unicode 13 : carrage return
                // Unicode 9 : tabulation
                return (ignoredChar.indexOf(implicitChar) === -1) && (code !== 13) && (code !== 9);
            } else {
                return true;
            }
        }
        
        this.hasHints = function (editor, implicitChar) {
            console.log("hasHints");
            console.log(ProjectManager.getProjectRoot()._path);
            this.editor = editor;
            this.projectRootPath = ProjectManager.getProjectRoot()._path;
            
            return isValidToken(implicitChar);
        };
  
        this.getHints = function (implicitChar) {
            console.log("getHints");
            console.log("implicitChar: " + implicitChar + " et " + isValidToken(implicitChar));
            
            if (isValidToken(implicitChar)) {
                var deferred = new $.Deferred();
                
                var currentLinePosition = this.editor.getCursorPos().line + 1,
                    currentColPosition = this.editor.getCursorPos().ch;
                
                getHint(this.editor.document.getText(), this.projectRootPath, currentLinePosition, currentColPosition)
                    .fail(function (err) {
                        deferred.reject(err);
                    })
                    .then(function (dataJSON) {
                        var hintList = [];
                        
                        console.log("Done:" + JSON.stringify(dataJSON));
                        
                        dataJSON.forEach(function (node, number) {
                            if (node.type === "function") {
                                hintList.push(node.name + "()");
                            } else {
                                hintList.push(node.name);
                            }
                        });
                        
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
            console.log("Inserted hint: " + hint);
            var cursor              = this.editor.getCursorPos(),
                currentToken        =  this.editor._codeMirror.getTokenAt(cursor),
                startToken          = {line: cursor.line, ch: currentToken.start},
                endToken            = {line: cursor.line, ch: cursor.ch};
            
            this.editor.document.replaceRange(hint, startToken, endToken);
            
            // When a function, move the cursor inside the ()
            if (hint.slice(-1) === ")") {
                cursor = this.editor.getCursorPos();
                this.editor.setCursorPos({
                    line: cursor.line,
                    ch: cursor.ch - 1
                });
            }
            return false;
        };
    }
    

    function isLanguagePython(editor) {
        return editor.language.getId() === "python";
    }

    function menusHandler() {
        if (isLanguagePython(DocumentManager.getCurrentDocument())) {
            window.alert("This is a python file !");
        } else {
            window.alert("This is not a python file.");
        }
    }

    
    AppInit.appReady(function () {
        console.log(modulePath);
        console.log(ProjectManager.getBaseUrl());
        
        CodeHintManager.registerHintProvider(new PythonJediHintProvider(), ["python"], 1);
    });


    // Register the command
    CommandManager.register(MENU_NAME, MY_COMMAND_ID, menusHandler);

    // Register a menu item bound to the command
    var menu = Menus.getMenu(Menus.AppMenuBar.FILE_MENU);
    menu.addMenuItem(MY_COMMAND_ID);
});