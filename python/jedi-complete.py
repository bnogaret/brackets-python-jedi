import sys
import json
import jedi

def completions(source, line, column):
    """
    Generate list with completions for the line and column.
    Arguments:
        source: source code to generate completion for
        line, column: current cursor position in the source code
    Returns:
        list with dictionaries containing the name and type for all completions.
    """
    
    script = jedi.api.Script(source, line, column)

    return [
        {
            "name": i.name,
            #"description": completion.description,
            "type" : i.type,
            # "docstring": completion.docstring(),
        }
        for i in script.completions()]


def getDocumentation(source, line, column):
    """
    Get documentation for the line and column
    Arguments:
        source: source code to generate completion for
        line, column: current cursor position in the source code
    Returns:
        list with dictionaries containing the name and type for all completions.
    """
    
    script = jedi.Script(source, line, column)
    
    return [
        {
            "name" : i.name,
            "fullname" : i.full_name,
            "description" : i.description,
            "type" : i.type,
            "docstring" : i.docstring(),
            "moduleName" : i.module_name
        }
        for i in script.goto_definitions()]


def getUsages (source, line, column):
    """
    ?
    """
    
    script = jedi.Script(source, line, column)
    
    return ""


def goto(source, line, column):
    """
    Goto for the line and column
    
    Arguments:
        source: code to generate completion for
        line: line of the current cursor
        column: column of the current cursor
    
    Return:
        list of dictionaries containing the name, line, column and path for all completions. 
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
        res = json.dumps(getDocumentation(f.read(),line,column))
    else:
        raise Exception("Unknown method.")

    f.close()
    print(res)


if __name__ == '__main__':
    main()
