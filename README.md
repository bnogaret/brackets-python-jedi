pyhton-jedi-for-brackets
========================
Jedi for Brackets


Work in progress.


TODO:
* Test on Windows (can't test on Mac)
* No hint when writing a string (between " or ') ?
* No hint when current token < 2 or 3 ?
* Too many answers ? Sort the list (variable, then function, ...) ?
* Use child_process.spawn ?
* Should I really include directly Jedi ?
* Add color for proposition (as JS hint in Brackets)
* Cache for getHints ?
* let the '.' in ignoredChar ?
* goto definition / function ?
* handler to have documentation ?

Problems:
* when ( or . and add hint : delete last charachter