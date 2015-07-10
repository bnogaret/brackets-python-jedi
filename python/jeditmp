import sys
import jedi
import json


def completions(source, line, column):
    """
    Generate list with completions for the line and column.
    Arguments:
        source: source code to generate completion for
        line, column: current cursor position in the source code
    Returns:
        list with dictionaries containing the name and type for all completions.
    """
    script = jedi.api.Script(
        source=source,
        line=line,
        column=column,
    )

    completions = list()

    for completion in script.completions():
        completions.append({
            "name": completion.name,
            #"description": completion.description,
            "type" : completion.type,
            # "docstring": completion.docstring(),
        })

    return completions

def getDocumentation(source, line, column):
    """
    Goto for the line and column
    Arguments:
        source: source code to generate completion for
        line, column: current cursor position in the source code
    Returns:
        list with dictionaries containing the name and type for all completions.
    """
    script = jedi.Script(source, line, column)
    script.goto_definitions()[0].docstring()
    return ""

def goto(source, line, column):
    """
    Goto for the line and column
    Arguments:
        source: source code to generate completion for
        line, column: current cursor position in the source code
    Returns:
        list with dictionaries containing the line and column for all completions.
    """
    script = jedi.Script(source, line, column)
    definitions = list ()
    definitionList = script.goto_definitions()
    if not definitionList:
        return [
            {
                "name": i.name,
                "line": i.line,
                "column": i.column,
                "path" : i.module_path
            }
            for i in definitionList if not i.in_builtin_module()]
    else:
        definitionList = script.goto_assignments()
        return [
            {
                "name": i.name,
                "line": i.line,
                "column": i.column,
                "path" : i.module_path
            }
            for i in definitionList if not i.in_builtin_module()]

def main():
    documentPath = str(sys.argv[1])
    sys.path.append(documentPath)
    sourcePath = str(sys.argv[2])
    f = open(sourcePath, "r")
    line = int(sys.argv[3])
    column = int(sys.argv[4])
    calledFunction = str(sys.argv[5])

    res = ""

    if calledFunction == "goto":
        res = json.dumps(goto(f.read(),line,column))
    elif calledFunction == "completions":
        res = json.dumps(completions(f.read(),line,column))
    elif calledFunction == "documentation":
        res = json.dumps(completions(f.read(),line,column))
    else:
        raise Exception("Unknown method.")

    f.close()
    print(res)

if __name__ == '__main__':
    main()

# Examples :
# python jedi-complete.py /home/nogaret/.config/Brackets/extensions/user/brackets-python-jedi/python /home/nogaret/.config/Brackets/extensions/user/brackets-python-jedi/python/jeditmp 1 2
