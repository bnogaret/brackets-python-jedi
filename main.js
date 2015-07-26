/*jslint vars: true, plusplus: true, devel: true, nomen: true, regexp: true, indent: 4 */
/*global define, $, brackets, window */


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
    
    var JediUtils           = require("JediUtils"),
        InlineDocsWidget    = require("InlineDocsWidget");
    
    var MY_COMMAND_ID       = "bnogaret.brackets-python-jedi",
        MENU_NAME           = "Python Jedi Power over 9000",
        DOMAIN_NAME         = "pythonJedi",
        COMMAND_NAME_HINT   = "jediHintCommand",
        COMMAND_NAME_GOTO   = "jediGotoCommand",
        COMMAND_NAME_DOC    = "jediDocCommand";
    
    var modulePath          = ExtensionUtils.getModulePath(module),
        domainPath          = ExtensionUtils.getModulePath(module) + "node/JediDomain",
        pythonJediDomain    = new NodeDomain(DOMAIN_NAME, ExtensionUtils.getModulePath(module, "node/JediDomain")),
        nodeConnection;
    
    /**
     * Execute python and return a promise the Json result.
     */
    function getJson(call, pythonCode, projectRootPath, currentLine, currentCol) {
        
        var deferred = new $.Deferred();
        
        if (nodeConnection.connected()) {
            nodeConnection.disconnect();
        }
        
        nodeConnection.connect(true).fail(function (err) {
            console.error("[getJson] connect to node: ", err);
            deferred.reject(err);
        }).then(function () {
            return nodeConnection.loadDomains([domainPath], true)
                .fail(function (err) {
                    console.error("[getJson] domain: ", err);
                    deferred.reject(err);
                });
        }).then(function () {
            nodeConnection.domains[DOMAIN_NAME][call](modulePath, projectRootPath, pythonCode, currentLine, currentCol)
                .fail(function (err) {
                    console.error("[getJson] result: ", err);
                    deferred.reject(err);
                })
                .done(function (data) {
                    deferred.resolve(JSON.parse(data));
                });
        });
        
        return deferred;
    }
    
    /**
     * Class use for hints
     * http://brackets.io/docs/current/modules/editor/CodeHintManager.html
     * @constructor
     */
    function JediHint() {}
    
    JediHint.prototype.editor = null;
    JediHint.prototype.projectRootPath = null;
    
    /**
     * Determine for the current context whether JediHint can propose hints or not
     */
    JediHint.prototype.hasHints = function (editor, implicitChar) {
        console.log("hasHints");

        this.editor = editor;
        this.projectRootPath = ProjectManager.getProjectRoot()._path;

        var currentToken = JediUtils.getTokenAt(this.editor);

        if (!JediUtils.isHintable(currentToken)) {
            return false;
        } else {
            return JediUtils.isValidForHint(currentToken, implicitChar);
        }
    };
    
    /**
     * Returns a list of available url hints, if possible, for the current editor context.
     * hasHints must have returned true before.
     */
    JediHint.prototype.getHints = function (implicitChar) {
        console.log("getHints");

        if (JediUtils.isValidChar(implicitChar)) {
            var deferred = new $.Deferred();

            var currentLinePosition = this.editor.getCursorPos().line + 1,
                currentColPosition = this.editor.getCursorPos().ch;

            getJson(COMMAND_NAME_HINT, this.editor.document.getText(), this.projectRootPath, currentLinePosition, currentColPosition)
                .fail(function (err) {
                    console.error("[getHints]: " + err);
                    deferred.reject(err);
                })
                .then(function (dataJSON) {
                    var hintList = [];

                    console.log("[getHints]: " + JSON.stringify(dataJSON));

                    dataJSON.forEach(function (node, number) {
                        if (node.type === "function") {
                            hintList.push(node.name + "()");
                        } else {
                            hintList.push(node.name);
                        }
                    });

                    hintList.sort(JediUtils.compareHint);

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
    
    /**
     * Insert a given hint into the current editor context (current cursor position)
     * 
     * Currently, it always return false (the manager should NOT follow this insertion with an additional explicit hint request)
     */
    JediHint.prototype.insertHint = function (hint) {
        console.log("insertHint");

        var cursor              = this.editor.getCursorPos(),
            currentToken        = JediUtils.getTokenAt(this.editor, cursor),
            startToken          = {line: cursor.line, ch: currentToken.start},
            endToken            = {line: cursor.line, ch: cursor.ch};
                
        // Check if the hint starts with the character(s) between currentToken.start and cursor.ch of the current token
        if (hint.indexOf(currentToken.string.substring(0, cursor.ch -  currentToken.start)) === 0) {
            // Hack : should use Document but it seems there is a problem
            this.editor.document.replaceRange(hint, startToken, endToken);
        } else {
            // Case we add a hint after . or ( : we don't delete this character with the replaceRange
            this.editor.document.replaceRange(currentToken.string + hint, startToken, endToken);
        }

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
    
    /*
     * Provider for "Jump to definition" (ctrl + j)
     */
    function jumpToDefProvider(editor, cursor) {
        if (JediUtils.isLanguagePython(editor.document)) {
            var deferred = new $.Deferred(),
                source = editor.document.getText(),
                projectRootPath = ProjectManager.getProjectRoot()._path;
            
            getJson(COMMAND_NAME_GOTO, source, projectRootPath, cursor.line + 1, cursor.ch)
                .fail(function (err) {
                    console.error("[jumpToDefProvider]:" + err);
                    deferred.reject(err);
                })
                .then(function (dataJSON) {
                    console.log(dataJSON);
                    if (dataJSON && dataJSON[0] && !dataJSON[0].path) {
                        var l = dataJSON[0].line - 1,
                            token = JediUtils.getTokenAt(editor, {line: l, ch: dataJSON[0].column + 1}),
                            startCursor = {line: l, ch: token.start},
                            endCursor = {line: l, ch: token.end};
                        
                        editor.setSelection(startCursor, endCursor, true);
                    }
                    deferred.resolve();
                });
            
            return deferred;
        } else {
            return null;
        }
    }
        
    /*
     * Provider for "Quick Docs" (ctrl + k)
     */
    function inlineDocsProvider(editor, cursor) {
        console.log(editor);
        console.log(cursor);
        if (JediUtils.isLanguagePython(editor.document)) {
            var deferred = new $.Deferred(),
                source = editor.document.getText(),
                projectRootPath = ProjectManager.getProjectRoot()._path;
            
            getJson(COMMAND_NAME_DOC, source, projectRootPath, cursor.line + 1, cursor.ch)
                .fail(function (err) {
                    console.error("[inlineDocsProvider]:" + err);
                    deferred.reject(err);
                })
                .then(function (dataJSON) {
                    
                    console.log(dataJSON);
                    if (dataJSON && dataJSON[0]) {
                        var inlineDocsWidget = new InlineDocsWidget(JediUtils.jsonToDocsWidget(dataJSON[0]));
                        
                        inlineDocsWidget.load(editor);
                        deferred.resolve(inlineDocsWidget);
                    } else {
                        deferred.reject();
                    }
                });
            
            return deferred.promise();
        } else {
            return null;
        }
    }
    
    
    AppInit.appReady(function () {
        console.log(modulePath);
        
        nodeConnection = new NodeConnection();
        
        CodeHintManager.registerHintProvider(new JediHint(), ["python"], 1);
        
        EditorManager.registerJumpToDefProvider(jumpToDefProvider);
        
        EditorManager.registerInlineDocsProvider(inlineDocsProvider);
    });
});