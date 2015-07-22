brackets-python-jedi
========================

[brackets-python-jedi](https://github.com/bnogaret/brackets-python-jedi) is a [Brackets](http://brackets.io/) plugin.


[To have more information about Jedi](http://jedi.jedidjah.ch/en/latest/)

Work in progress. You can try and give me feedback.


## Shortcuts:
* <kbd>Ctrl</kbd>+<kbd>Space</kbd> : force to show hints
* <kbd>Ctrl</kbd>+<kbd>j</kbd> : jump to definitions or assignments
* <kbd>Ctrm</kbd>+<kbd>k</kbd> : get documentation


## TODO:
* Test on Windows (can't test on Mac)
* Add color for proposition (as JS hint in Brackets)
* Jump to def vers un autre fichier


## Problems:
* "[ERROR:getHint] domain:  cleanup" or "[ERROR:getHint] result:  cleanup"
* multiple "same" word (but not the same meanings)
* not at all efficient ! (slow down Brackets)


## Future:
* Better sorted list (variable first, then function ...)
* Use child_process.spawn rather than temp file ?
* Should I really include directly Jedi ?