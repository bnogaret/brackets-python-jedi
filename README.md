brackets-python-jedi
========================

[brackets-python-jedi](https://github.com/bnogaret/brackets-python-jedi) is a [Brackets](http://brackets.io/) plugin.


[To have more information about Jedi](http://jedi.jedidjah.ch/en/latest/)

Work in progress. You can try and give me feedback.


## Shortcuts:
* <kbd>Ctrl</kbd>+<kbd>Space</kbd> : force to show hints
* <kbd>Ctrl</kbd>+<kbd>J</kbd> : jump to definitions or assignments


## TODO:
* Test on Windows (can't test on Mac)
* No hint when current token < 2 or 3 ?
* Too many answers ? Sort the list (variable, then function, ...) ?
* Use child_process.spawn ?
* Should I really include directly Jedi ?
* Add color for proposition (as JS hint in Brackets)
* Cache for getHints ?
* let the '.' in ignoredChar ?
* handler to have documentation ?
* Add code style checking (i.e. pep8)


## Problems:
* when ( or . and add hint : delete last charachter
* "[ERROR:getHint] domain:  cleanup" or "[ERROR:getHint] result:  cleanup"
* multiple "same" word
* not at all efficient ! (slow down Brackets)