/*jslint vars: true, plusplus: true, devel: true, nomen: true, regexp: true, indent: 4 */
/*global define, $, brackets, window, Mustache */


/** 
 * Python jedi extension
 * Add autocomplete (using Jedi) for python documents
*/
define(function (require, exports, module) {
    "use strict";

    var CommandManager      = brackets.getModule("command/CommandManager"),
        DocumentManager     = brackets.getModule("document/DocumentManager"),
        AppInit             = brackets.getModule("utils/AppInit"),
        EditorManager       = brackets.getModule("editor/EditorManager"),
        CodeHintManager     = brackets.getModule("editor/CodeHintManager"),
        NodeDomain          = brackets.getModule("utils/NodeDomain"),
        NodeConnection      = brackets.getModule("utils/NodeConnection"),
        ProjectManager      = brackets.getModule("project/ProjectManager"),
        ExtensionUtils      = brackets.getModule("utils/ExtensionUtils"),
        Menus               = brackets.getModule("command/Menus");
    
    var HintUtils = require("HintUtils");
    
    var MY_COMMAND_ID       = "bnogaret.brackets-python-jedi",
        MENU_NAME           = "Python Jedi Power over 9000",
        DOMAIN_NAME         = "pythonJedi",
        COMMAND_NAME_HINT   = "jediHintCommand",
        COMMAND_NAME_GOTO   = "jediGotoCommand";
    
    var modulePath          = ExtensionUtils.getModulePath(module),
        nodeConnection      = new NodeConnection(),
        domainPath          = ExtensionUtils.getModulePath(module) + "/node/JediDomain",
        pythonJediDomain    = new NodeDomain(DOMAIN_NAME, ExtensionUtils.getModulePath(module, "node/JediDomain"));
    
    /**
     * Execute python and return a promise the Json result.
     */
    function getJson(call, pythonCode, projectRootPath, currentLine, currentCol) {
        
        var deferred = new $.Deferred();
        
        nodeConnection.connect(true).fail(function (err) {
            console.error("[ERROR:getJson] connect to node: ", err);
            deferred.reject(err);
        }).then(function () {
            return nodeConnection.loadDomains([domainPath], true).fail(function (err) {
                console.error("[ERROR:getJson] domain: ", err);
            });
        }).then(function () {
            nodeConnection.domains[DOMAIN_NAME][call](modulePath, projectRootPath, pythonCode, currentLine, currentCol)
                .fail(function (err) {
                    console.error("[ERROR:getJson] result: ", err);
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
        
        var editor,
            projectRootPath;
        
        this.hasHints = function (editor, implicitChar) {
            console.log("hasHints");
            console.log(ProjectManager.getProjectRoot()._path);
            this.editor = editor;
            this.projectRootPath = ProjectManager.getProjectRoot()._path;
            
            var currentToken = this.editor._codeMirror.getTokenAt(this.editor.getCursorPos());
            
            if (!HintUtils.isHintable(currentToken)) {
                return false;
            } else {
                return HintUtils.isValidToken(implicitChar);
            }
        };
  
        this.getHints = function (implicitChar) {
            console.log("getHints");
            console.log("implicitChar: " + implicitChar + " et " + HintUtils.isValidToken(implicitChar));
            
            if (HintUtils.isValidToken(implicitChar)) {
                var deferred = new $.Deferred();
                
                var currentLinePosition = this.editor.getCursorPos().line + 1,
                    currentColPosition = this.editor.getCursorPos().ch;
                
                getJson(COMMAND_NAME_HINT, this.editor.document.getText(), this.projectRootPath, currentLinePosition, currentColPosition)
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
                        
                        console.log(hintList);
                        hintList.sort(HintUtils.compareHint);
                    
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
            
            // Hack : should use Document but it seems there is a problem
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
    
    function jumpToDefHandler(editor, cursor) {
        console.log(editor);
        console.log(cursor);
        if (HintUtils.isLanguagePython(editor.document)) {
            var deferred = new $.Deferred(),
                source = editor.document.getText(),
                projectRootPath = ProjectManager.getProjectRoot()._path;
            
            getJson(COMMAND_NAME_GOTO, source, projectRootPath, cursor.line + 1, cursor.ch)
                .fail(function (err) {
                    console.log(err);
                    deferred.reject(err);
                })
                .then(function (dataJSON) {
                    console.log(dataJSON);
                    if (!dataJSON[0].path) {
                        editor.setCursorPos(dataJSON[0].line - 1, dataJSON[0].column);
                        deferred.resolve();
                    }
                });
            
            return deferred;
        } else {
            return null;
        }
    }

    function menusHandler() {
        if (HintUtils.isLanguagePython(DocumentManager.getCurrentDocument())) {
            var editor = EditorManager.getActiveEditor();
            
            jumpToDefHandler(editor, editor.getCursorPos());
            
        } else {
            window.alert("This is not a python file.");
        }
    }
    
    
    AppInit.appReady(function () {
        console.log(modulePath);
        
        CodeHintManager.registerHintProvider(new PythonJediHintProvider(), ["python"], 1);
        
        EditorManager.registerJumpToDefProvider(jumpToDefHandler);
    });


    // Register the command
    CommandManager.register(MENU_NAME, MY_COMMAND_ID, menusHandler);

    // Register a menu item bound to the command
    var menu = Menus.getMenu(Menus.AppMenuBar.FILE_MENU);
    menu.addMenuItem(MY_COMMAND_ID, "Ctrl-Shift-G");
});