/*jslint vars: true, plusplus: true, devel: true, nomen: true, regexp: true, indent: 4 */
/*global define */

define(function (require, exports, module) {
    "use strict";
    
    var LANGUAGE_PYHTON_ID = "python",
        ignoredChar = [' ', '+', '-', '/', '*', '(', ')', '[', ']', ':', ',', '<', '>', '.', '{', '}', '=', '%', '!'];
    
    /**
     * Is the token hintable ? No if inside a comment or inside a string
     * @param
     * @return {boolean}
     */
    function isHintable(token) {
        switch (token.type) {
        case "comment":
        case "string":
            return false;
        default:
            return true;
        }
    }
    
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
    
    exports.isHintable = isHintable;
    exports.isLanguagePython = isLanguagePython;
    exports.compareHint = compareHint;
    exports.isValidToken = isValidToken;
});