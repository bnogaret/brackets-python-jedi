/*jslint vars: true, plusplus: true, devel: true, nomen: true, regexp: true, indent: 4 */
/*global define */

define(function (require, exports, module) {
    "use strict";
    
    var LANGUAGE_PYHTON_ID = "python",
        IGNORED_CHARACTERS = [' ', '+', '-', '/', '*', '(', ')', '[', ']', ':', ',', '<', '>', '{', '}', '=', '%', '!'];
    
    /**
     * Is the token hintable ? No if inside a comment or inside a string and is too short (number of characters < 3)
     * @param token
     * @return {boolean}
     */
    function isHintable(token) {
        var bool;
        switch (token.type) {
        case "comment":
        case "string":
            return false;
        default:
            break;
        }
        
        if (token.string.length < 3) {
            return false;
        }
        
        return true;
    }
    
    function isValidToken(implicitChar) {
        if (implicitChar) {
            var code = implicitChar.charCodeAt(0);
            // Unicode 13 : carrage return
            // Unicode 9 : tabulation
            return (IGNORED_CHARACTERS.indexOf(implicitChar) === -1) && (code !== 13) && (code !== 9);
        } else {
            return true;
        }
    }
    
    function isLanguagePython(editor) {
        return editor.language.getId() === LANGUAGE_PYHTON_ID;
    }
    
    /**
     * Comparison function used for sorting that does a case-insensitive string comparison on the "value" field of both objects.
     * Unlike a normal string comparison, however, this sorts leading "_" to the bottom.
     */
    function compareHint(a, b) {
        var aName = a.toLowerCase(),
            bName = b.toLowerCase();
        
        if (aName[0] === "_" && bName[0] !== "_") {
            return 1;
        } else if (bName[0] === "_" && aName[0] !== "_") {
            return -1;
        }
        if (aName < bName) {
            return -1;
        } else if (aName > bName) {
            return 1;
        }
        return 0;
        
    }
    
    /**
     * Replace special characters (>, &, ...) from str by their html equivalents
     */
    function encodeToHtml(str) {
        return str
            .trim()
            .replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/[\n]{2,}/g, '<br /><br />') // Avoid having lots of space
            .replace(/\n/g, '<br />');
    }
    
    /**
     * Create the var template for InlineDocsWidget from the json return by jedi-complete.py (getDocumentation)
     */
    function jsonToDocsWidget(json) {
        var list = [];
        list.push({
            value       : "Type :",
            description : json.type
        });
        
        if (json.description) {
            list.push({
                value       : "Description :",
                description : json.description
            });
        }
        
        if (json.docstring) {
            list.push({
                value       : "Docs :",
                description : encodeToHtml(json.docstring)
            });
        }
        
        var template = {
            propName : json.name,
            propFullName : json.fullname,
            propValues : list,
            propModule : json.moduleName || "<i>Not defined</i>"
        };
        
        return template;
    }
    
    
    exports.isHintable          = isHintable;
    exports.isLanguagePython    = isLanguagePython;
    exports.compareHint         = compareHint;
    exports.isValidToken        = isValidToken;
    exports.encodeToHtml        = encodeToHtml;
    exports.jsonToDocsWidget    = jsonToDocsWidget;
});