/*jslint vars: true, plusplus: true, devel: true, nomen: true, regexp: true, indent: 4 */
/*global define, Mustache, brackets, $ */

define(function (require, exports, module) {
    "use strict";
    
    var ExtensionUtils      = brackets.getModule("utils/ExtensionUtils"),
        InlineWidget        = brackets.getModule("editor/InlineWidget").InlineWidget,
        KeyEvent            = brackets.getModule("utils/KeyEvent");
    
    var SCROLL_LINE_HEIGHT  = 40;
    
     // Load template
    var inlineDocsTemplate  = require("text!./templates/InlineDocsWidget.html");
    
    // Load CSS
    ExtensionUtils.loadStyleSheet(module, "InlineDocsWidget.less");
    
    function InlineDocsWidget(templateVars) {
        InlineWidget.call(this);
        
        var html = Mustache.render(inlineDocsTemplate, templateVars);
        
        this.$wrapperDiv = $(html);
        this.$htmlContent.append(this.$wrapperDiv);
        
        this._sizeEditorToContent   = this._sizeEditorToContent.bind(this);
        this._handleWheelScroll     = this._handleWheelScroll.bind(this);

        this.$scroller = this.$wrapperDiv.find(".scroller");
        this.$scroller.on("mousewheel", this._handleWheelScroll);
        this._onKeydown = this._onKeydown.bind(this);
    }
    
    InlineDocsWidget.prototype = Object.create(InlineWidget.prototype);
    InlineDocsWidget.prototype.constructor = InlineDocsWidget;
    InlineDocsWidget.prototype.parentClass = InlineWidget.prototype;
    
    InlineDocsWidget.prototype.$wrapperDiv = null;
    InlineDocsWidget.prototype.$scroller = null;
    
    /**
     * Handle scrolling.
     *
     * @param {Event} event Keyboard event or mouse scrollwheel event
     * @param {boolean} scrollingUp Is event to scroll up?
     * @param {DOMElement} scroller Element to scroll
     * @return {boolean} indication whether key was handled
     */
    InlineDocsWidget.prototype._handleScrolling = function (event, scrollingUp, scroller) {
        // We need to block the event from both the host CodeMirror code (by stopping bubbling) and the
        // browser's native behavior (by preventing default). We preventDefault() *only* when the docs
        // scroller is at its limit (when an ancestor would get scrolled instead); otherwise we'd block
        // normal scrolling of the docs themselves.
        event.stopPropagation();
        if (scrollingUp && scroller.scrollTop === 0) {
            event.preventDefault();
            return true;
        } else if (!scrollingUp && scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight) {
            event.preventDefault();
            return true;
        }
        
        return false;
    };
    
    /** Don't allow scrollwheel/trackpad to bubble up to host editor - makes scrolling docs painful */
    InlineDocsWidget.prototype._handleWheelScroll = function (event) {
        var scrollingUp = (event.originalEvent.wheelDeltaY > 0),
            scroller = event.currentTarget;
        
        // If content has no scrollbar, let host editor scroll normally
        if (scroller.clientHeight >= scroller.scrollHeight) {
            return;
        }
        
        this._handleScrolling(event, scrollingUp, scroller);
    };
    
    
    /**
     * Convert keydown events into navigation actions.
     *
     * @param {KeyboardEvent} event
     * @return {boolean} indication whether key was handled
     */
    InlineDocsWidget.prototype._onKeydown = function (event) {
        var keyCode  = event.keyCode,
            scroller = this.$scroller[0],
            scrollPos;

        // Ignore key events with modifier keys
        if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) {
            return false;
        }

        // Handle keys that we're interested in
        scrollPos = scroller.scrollTop;

        switch (keyCode) {
        case KeyEvent.DOM_VK_UP:
            scrollPos = Math.max(0, scrollPos - SCROLL_LINE_HEIGHT);
            break;
        case KeyEvent.DOM_VK_PAGE_UP:
            scrollPos = Math.max(0, scrollPos - scroller.clientHeight);
            break;
        case KeyEvent.DOM_VK_DOWN:
            scrollPos = Math.min(scroller.scrollHeight - scroller.clientHeight, scrollPos + SCROLL_LINE_HEIGHT);
            break;
        case KeyEvent.DOM_VK_PAGE_DOWN:
            scrollPos = Math.min(scroller.scrollHeight - scroller.clientHeight, scrollPos + scroller.clientHeight);
            break;
        default:
            // Ignore other keys
            return false;
        }

        scroller.scrollTop = scrollPos;

        // Disallow further processing
        event.stopPropagation();
        event.preventDefault();
        return true;
    };
    
    InlineDocsWidget.prototype.onAdded = function () {
        InlineDocsWidget.prototype.parentClass.onAdded.apply(this, arguments);
        
        // Set height initially, and again whenever width might have changed (word wrap)
        this._sizeEditorToContent();
        $(window).on("resize", this._sizeEditorToContent);

        // Set focus
        this.$scroller[0].focus();
        this.$wrapperDiv[0].addEventListener("keydown", this._onKeydown, true);
    };
    
    InlineDocsWidget.prototype.onClosed = function () {
        InlineDocsWidget.prototype.parentClass.onClosed.apply(this, arguments);
        
        $(window).off("resize", this._sizeEditorToContent);
        this.$wrapperDiv[0].removeEventListener("keydown", this._onKeydown, true);
    };
    
    InlineDocsWidget.prototype._sizeEditorToContent = function () {
        this.hostEditor.setInlineWidgetHeight(this, this.$wrapperDiv.height() + 20, true);
    };
    
    
    module.exports = InlineDocsWidget;
});